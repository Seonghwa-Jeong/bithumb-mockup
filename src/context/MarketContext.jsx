import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { COINS, COIN_MAP, initialTicker, nextPrice } from '../lib/market.js'
import { track, fetchExperiment } from '../lib/amplitude.js'
import { useAuth } from './AuthContext.jsx'

const MarketContext = createContext(null)

const FEE_RATE = 0.0004 // 체결 수수료 0.04%
const TICK_MS = 1000 // 시세 갱신 주기
const MARKET_FILL_DELAY = 1500 // 시장가 체결 지연(ms) — "타이밍 차이"
const LIMIT_MIN_DELAY = 1200 // 지정가 최소 체결 지연(ms)

function portfolioKey(userId) {
  return `bithumb_portfolio_${userId}`
}

function loadPortfolio(user) {
  if (!user) return null
  try {
    const saved = JSON.parse(localStorage.getItem(portfolioKey(user.id)))
    if (saved) return saved
  } catch {
    /* ignore */
  }
  return {
    krw: user.krw ?? 1_000_000,
    krwInOrder: 0,
    holdings: {}, // { BTC: { amount, inOrder, avgBuy } }
    openOrders: [],
    history: [],
  }
}

export function MarketProvider({ children }) {
  const { user } = useAuth()

  // ---- 실시간 시세 --------------------------------------------------------
  const [tickers, setTickers] = useState(() => {
    const t = {}
    for (const c of COINS) t[c.symbol] = initialTicker(c)
    return t
  })
  const tickersRef = useRef(tickers)
  tickersRef.current = tickers

  // ---- 유저 포트폴리오 ----------------------------------------------------
  const [portfolio, setPortfolio] = useState(() => loadPortfolio(user))
  const portfolioRef = useRef(portfolio)
  portfolioRef.current = portfolio

  // 유저 변경 시 포트폴리오 재로딩
  useEffect(() => {
    setPortfolio(loadPortfolio(user))
  }, [user])

  // 포트폴리오 영속화
  useEffect(() => {
    if (user && portfolio) {
      localStorage.setItem(portfolioKey(user.id), JSON.stringify(portfolio))
    }
  }, [user, portfolio])

  // ---- 시세 틱 루프 + 지정가 체결 엔진 ------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setTickers((prev) => {
        const next = {}
        for (const c of COINS) {
          const cur = prev[c.symbol]
          const price = nextPrice(cur.price, c)
          next[c.symbol] = {
            ...cur,
            price,
            changePct: ((price - cur.prevClose) / cur.prevClose) * 100,
            high24: Math.max(cur.high24, price),
            low24: Math.min(cur.low24, price),
            volume24: cur.volume24 + Math.random() * c.base,
          }
        }
        tickersRef.current = next
        // 새 가격으로 지정가 미체결 주문 검사
        matchLimitOrders(next)
        return next
      })
    }, TICK_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 지정가 주문 체결 검사
  function matchLimitOrders(latestTickers) {
    const p = portfolioRef.current
    if (!p || p.openOrders.length === 0) return
    const now = Date.now()
    const toFill = p.openOrders.filter((o) => {
      if (o.type !== 'limit') return false
      if (now - o.createdAt < LIMIT_MIN_DELAY) return false // 최소 지연
      const mkt = latestTickers[o.symbol]?.price
      if (mkt == null) return false
      return o.side === 'buy' ? mkt <= o.price : mkt >= o.price
    })
    if (toFill.length === 0) return
    toFill.forEach((o) => fillOrder(o.id))
  }

  // ---- 주문 체결 처리 -----------------------------------------------------
  function fillOrder(orderId) {
    setPortfolio((p) => {
      const order = p.openOrders.find((o) => o.id === orderId)
      if (!order) return p
      const openOrders = p.openOrders.filter((o) => o.id !== orderId)
      const fillPrice = order.type === 'market' ? tickersRef.current[order.symbol].price : order.price
      const gross = fillPrice * order.amount
      const fee = gross * FEE_RATE
      const holdings = { ...p.holdings }
      const h = holdings[order.symbol] || { amount: 0, inOrder: 0, avgBuy: 0 }
      let krw = p.krw
      let krwInOrder = p.krwInOrder

      if (order.side === 'buy') {
        // 예약해둔 원화(주문금액+수수료)를 소진
        krwInOrder -= order.reservedKRW
        const newAmount = h.amount + order.amount
        const newAvg = newAmount > 0 ? (h.avgBuy * h.amount + gross) / newAmount : 0
        holdings[order.symbol] = { ...h, amount: newAmount, avgBuy: newAvg }
      } else {
        // 예약해둔 코인 소진, 원화 수령
        holdings[order.symbol] = { ...h, inOrder: h.inOrder - order.amount }
        krw += gross - fee
      }

      const filled = {
        ...order,
        status: 'filled',
        fillPrice,
        fee,
        filledAt: Date.now(),
      }
      track('Order Filled', {
        symbol: order.symbol,
        coin_name: COIN_MAP[order.symbol]?.name,
        side: order.side,
        order_type: order.type,
        fill_price: fillPrice,
        amount: order.amount,
        notional_krw: Math.round(gross),
        fee_krw: Math.round(fee),
        latency_ms: Date.now() - order.createdAt,
        location: 'fill_engine',
      })
      return {
        ...p,
        krw,
        krwInOrder,
        holdings,
        openOrders,
        history: [filled, ...p.history].slice(0, 200),
      }
    })
  }

  // ---- 주문 접수 ----------------------------------------------------------
  /**
   * @returns {{ok:boolean, error?:string}}
   */
  function placeOrder({ symbol, side, type, price, amount, location = 'exchange_trade_panel' }) {
    const coin = COIN_MAP[symbol]
    if (!coin) return { ok: false, error: '알 수 없는 코인입니다.' }
    if (!amount || amount <= 0) return { ok: false, error: '수량을 입력하세요.' }
    const mkt = tickersRef.current[symbol].price
    const execPrice = type === 'market' ? mkt : price
    if (type === 'limit' && (!price || price <= 0))
      return { ok: false, error: '지정가를 입력하세요.' }

    const p = portfolioRef.current
    const gross = execPrice * amount
    const fee = gross * FEE_RATE

    // 잔고 검증 + 예약
    if (side === 'buy') {
      const need = gross + fee
      const available = p.krw - p.krwInOrder
      if (need > available) return { ok: false, error: '주문 가능 원화가 부족합니다.' }
    } else {
      const h = p.holdings[symbol] || { amount: 0, inOrder: 0 }
      const available = h.amount - h.inOrder
      if (amount > available) return { ok: false, error: '매도 가능 수량이 부족합니다.' }
    }

    const order = {
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
      symbol,
      side,
      type,
      price: execPrice,
      amount,
      reservedKRW: side === 'buy' ? gross + fee : 0,
      status: 'pending',
      createdAt: Date.now(),
    }

    setPortfolio((prev) => {
      const next = { ...prev }
      if (side === 'buy') {
        next.krwInOrder = prev.krwInOrder + order.reservedKRW
      } else {
        const h = prev.holdings[symbol] || { amount: 0, inOrder: 0, avgBuy: 0 }
        next.holdings = { ...prev.holdings, [symbol]: { ...h, inOrder: h.inOrder + amount } }
      }
      next.openOrders = [order, ...prev.openOrders]
      return next
    })

    track('Order Placed', {
      symbol,
      coin_name: coin.name,
      side,
      order_type: type,
      price: execPrice,
      amount,
      notional_krw: Math.round(gross),
      fee_krw: Math.round(fee),
      location,
    })

    // 시장가는 지연 후 체결, 지정가는 틱 루프가 조건 충족 시 체결
    if (type === 'market') {
      setTimeout(() => fillOrder(order.id), MARKET_FILL_DELAY)
    }
    return { ok: true }
  }

  function cancelOrder(orderId, location = 'exchange') {
    const target = portfolioRef.current?.openOrders.find((o) => o.id === orderId)
    setPortfolio((p) => {
      const order = p.openOrders.find((o) => o.id === orderId)
      if (!order) return p
      const openOrders = p.openOrders.filter((o) => o.id !== orderId)
      const next = { ...p, openOrders }
      // 예약 해제
      if (order.side === 'buy') {
        next.krwInOrder = p.krwInOrder - order.reservedKRW
      } else {
        const h = p.holdings[order.symbol]
        next.holdings = {
          ...p.holdings,
          [order.symbol]: { ...h, inOrder: h.inOrder - order.amount },
        }
      }
      next.history = [{ ...order, status: 'canceled', filledAt: Date.now() }, ...p.history].slice(0, 200)
      return next
    })
    if (target) {
      track('Order Canceled', {
        order_id: orderId,
        symbol: target.symbol,
        side: target.side,
        order_type: target.type,
        location,
      })
    }
  }

  // ---- 입출금 (목업) ------------------------------------------------------
  function deposit(amount) {
    if (!amount || amount <= 0) return { ok: false, error: '금액을 입력하세요.' }
    const p = portfolioRef.current
    setPortfolio((prev) => ({ ...prev, krw: prev.krw + amount }))
    track('Wallet Deposit Completed', {
      asset: 'KRW',
      amount,
      balance_after: p.krw + amount,
      location: 'wallet',
    })
    return { ok: true }
  }

  function withdraw(amount) {
    const p = portfolioRef.current
    if (!amount || amount <= 0) return { ok: false, error: '금액을 입력하세요.' }
    if (amount > p.krw - p.krwInOrder) {
      track('Wallet Withdraw Failed', {
        asset: 'KRW',
        amount,
        failure_reason: 'insufficient_balance',
        location: 'wallet',
      })
      return { ok: false, error: '출금 가능 잔고가 부족합니다.' }
    }
    setPortfolio((prev) => ({ ...prev, krw: prev.krw - amount }))
    track('Wallet Withdraw Completed', {
      asset: 'KRW',
      amount,
      balance_after: p.krw - amount,
      location: 'wallet',
    })
    return { ok: true }
  }

  function resetAccount() {
    if (!user) return
    localStorage.removeItem(portfolioKey(user.id))
    setPortfolio(loadPortfolio({ ...user }))
    track('Account Reset', { location: 'portfolio', user_tier: user.tier })
    // 계좌(잔고·보유코인 등 사용자 상태) 재등록 → Experiment 재평가
    fetchExperiment('account_reset')
  }

  // ---- 파생 값 ------------------------------------------------------------
  const totals = useMemo(() => {
    if (!portfolio) return { coinValue: 0, totalValue: 0, totalBuy: 0, pnl: 0, pnlPct: 0 }
    let coinValue = 0
    let totalBuy = 0
    for (const [sym, h] of Object.entries(portfolio.holdings)) {
      if (h.amount <= 0) continue
      const price = tickers[sym]?.price || 0
      coinValue += price * h.amount
      totalBuy += h.avgBuy * h.amount
    }
    const totalValue = portfolio.krw + portfolio.krwInOrder + coinValue
    const pnl = coinValue - totalBuy
    const pnlPct = totalBuy > 0 ? (pnl / totalBuy) * 100 : 0
    return { coinValue, totalValue, totalBuy, pnl, pnlPct }
  }, [portfolio, tickers])

  return (
    <MarketContext.Provider
      value={{
        tickers,
        coins: COINS,
        portfolio,
        totals,
        placeOrder,
        cancelOrder,
        deposit,
        withdraw,
        resetAccount,
      }}
    >
      {children}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
