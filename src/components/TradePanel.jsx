import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarket } from '../context/MarketContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { COIN_MAP, tickSize } from '../lib/market.js'
import { formatKRW, formatCoin, formatPrice } from '../lib/format.js'
import { getPayload, track } from '../lib/amplitude.js'

const PERCENTS = [10, 25, 50, 100]
const FEE_RATE = 0.0004

export default function TradePanel({ symbol, pickedPrice }) {
  const { tickers, portfolio, placeOrder } = useMarket()
  const { user } = useAuth()
  const navigate = useNavigate()
  const coin = COIN_MAP[symbol]
  const t = tickers[symbol]

  const [side, setSide] = useState('buy')
  const [orderType, setOrderType] = useState('limit') // limit | market
  const [price, setPrice] = useState(() => t.price)
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState(null)

  // 호가창에서 가격을 클릭하면 지정가로 반영
  useEffect(() => {
    if (pickedPrice != null) {
      setOrderType('limit')
      setPrice(pickedPrice)
    }
  }, [pickedPrice])

  // 시장가로 바꾸면 현재가를 추종
  useEffect(() => {
    if (orderType === 'market') setPrice(t.price)
  }, [orderType, t.price])

  // Amplitude Experiment(remote config): 매수 버튼 문구/강조를 payload 로 원격 제어
  const buyCta = getPayload('buy-cta', { label: '매수', emphasis: false })
  const buyLabel = buyCta.label || '매수'

  const effectivePrice = orderType === 'market' ? t.price : Number(price) || 0
  const amountNum = Number(amount) || 0
  const total = effectivePrice * amountNum
  const fee = total * FEE_RATE

  const available = useMemo(() => {
    if (!portfolio) return 0
    if (side === 'buy') return portfolio.krw - portfolio.krwInOrder
    const h = portfolio.holdings[symbol]
    return h ? h.amount - h.inOrder : 0
  }, [portfolio, side, symbol])

  function applyPercent(pct) {
    if (side === 'buy') {
      const budget = (available * pct) / 100
      const qty = effectivePrice > 0 ? budget / (effectivePrice * (1 + FEE_RATE)) : 0
      setAmount(qty ? qty.toFixed(8) : '')
    } else {
      setAmount(((available * pct) / 100).toFixed(8))
    }
    track('Order Ratio Clicked', {
      symbol,
      side,
      percent: pct,
      order_type: orderType,
      location: 'exchange_trade_panel',
    })
  }

  function stepPrice(dir) {
    const tick = tickSize(effectivePrice)
    setPrice((p) => Math.max(tick, (Number(p) || 0) + dir * tick))
  }

  function selectSide(next) {
    if (next === side) return
    setSide(next)
    track('Order Side Changed', { symbol, side: next, location: 'exchange_trade_panel' })
  }

  function selectOrderType(next) {
    if (next === orderType) return
    setOrderType(next)
    track('Order Type Changed', { symbol, order_type: next, location: 'exchange_trade_panel' })
  }

  function submit(e) {
    e.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    const res = placeOrder({
      symbol,
      side,
      type: orderType,
      price: orderType === 'market' ? t.price : Number(price),
      amount: amountNum,
      location: 'exchange_trade_panel',
    })
    if (res.ok) {
      setToast({
        type: 'ok',
        msg:
          orderType === 'market'
            ? `${side === 'buy' ? '매수' : '매도'} 주문 접수 — 잠시 후 체결됩니다.`
            : `${side === 'buy' ? '매수' : '매도'} 지정가 주문이 등록되었습니다.`,
      })
      setAmount('')
    } else {
      track('Order Submit Failed', {
        symbol,
        side,
        order_type: orderType,
        failure_reason: res.error,
        location: 'exchange_trade_panel',
      })
      setToast({ type: 'err', msg: res.error })
    }
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="trade-panel">
      <div className="side-tabs">
        <button
          className={`side-tab buy ${side === 'buy' ? 'active' : ''}`}
          onClick={() => selectSide('buy')}
        >
          매수
        </button>
        <button
          className={`side-tab sell ${side === 'sell' ? 'active' : ''}`}
          onClick={() => selectSide('sell')}
        >
          매도
        </button>
      </div>

      <div className="type-tabs">
        {['limit', 'market'].map((ty) => (
          <button
            key={ty}
            className={orderType === ty ? 'type-tab active' : 'type-tab'}
            onClick={() => selectOrderType(ty)}
          >
            {ty === 'limit' ? '지정가' : '시장가'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="order-form">
        <div className="of-row">
          <span className="of-label">주문가능</span>
          <span className="of-value">
            {side === 'buy'
              ? formatKRW(available)
              : `${formatCoin(available)} ${symbol}`}
          </span>
        </div>

        <label className="field">
          <span>가격 (KRW)</span>
          <div className={`stepper ${orderType === 'market' ? 'disabled' : ''}`}>
            <button type="button" onClick={() => stepPrice(-1)} disabled={orderType === 'market'}>
              −
            </button>
            <input
              type="number"
              value={orderType === 'market' ? '' : price}
              placeholder={orderType === 'market' ? '시장가' : ''}
              onChange={(e) => setPrice(e.target.value)}
              disabled={orderType === 'market'}
            />
            <button type="button" onClick={() => stepPrice(1)} disabled={orderType === 'market'}>
              +
            </button>
          </div>
        </label>

        <label className="field">
          <span>수량 ({symbol})</span>
          <input
            type="number"
            step="any"
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <div className="percent-row">
          {PERCENTS.map((p) => (
            <button type="button" key={p} onClick={() => applyPercent(p)}>
              {p === 100 ? '최대' : `${p}%`}
            </button>
          ))}
        </div>

        <div className="of-row total">
          <span className="of-label">주문총액</span>
          <span className="of-value strong">{formatKRW(total)}</span>
        </div>
        <div className="of-row small">
          <span className="of-label">예상 수수료 (0.04%)</span>
          <span className="of-value">{formatKRW(fee)}</span>
        </div>

        {user ? (
          <button
            type="submit"
            className={`btn-order ${side} ${side === 'buy' && buyCta.emphasis ? 'emphasis' : ''}`}
          >
            {side === 'buy' ? buyLabel : '매도'}
          </button>
        ) : (
          <button
            type="button"
            className={`btn-order ${side}`}
            onClick={() => {
              track('Trade Login Prompted', {
                symbol,
                side,
                order_type: orderType,
                location: 'exchange_trade_panel',
              })
              navigate('/login')
            }}
          >
            로그인하고 거래하기
          </button>
        )}
      </form>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
