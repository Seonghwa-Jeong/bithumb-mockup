import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMarket } from '../context/MarketContext.jsx'
import { COIN_MAP } from '../lib/market.js'
import { formatPrice, formatPct, formatVolume, formatCoin, formatKRW, formatTime } from '../lib/format.js'
import { track } from '../lib/amplitude.js'
import CoinChart from '../components/CoinChart.jsx'
import OrderBook from '../components/OrderBook.jsx'
import TradePanel from '../components/TradePanel.jsx'

export default function Exchange() {
  const { symbol = 'BTC' } = useParams()
  const navigate = useNavigate()
  const { coins, tickers, portfolio, cancelOrder } = useMarket()
  const coin = COIN_MAP[symbol]
  const [pickedPrice, setPickedPrice] = useState(null)

  if (!coin) {
    return <div className="empty">존재하지 않는 코인입니다.</div>
  }
  const t = tickers[symbol]
  const up = t.changePct >= 0

  const openOrders = useMemo(
    () => (portfolio?.openOrders || []).filter((o) => o.symbol === symbol),
    [portfolio, symbol],
  )
  const allOpen = portfolio?.openOrders || []

  function pickPrice(p) {
    setPickedPrice(p)
    // 같은 값 재클릭도 반영되도록 살짝 흔들어 준다
    setTimeout(() => setPickedPrice({ v: p, ts: Date.now() }.v), 0)
    track('Orderbook Price Selected', {
      symbol,
      coin_name: coin.name,
      price: p,
      location: 'exchange_orderbook',
    })
  }

  return (
    <div className="exchange">
      {/* 좌측: 코인 목록 */}
      <aside className="ex-coinlist">
        <div className="ex-coinlist-head">원화마켓</div>
        <div className="ex-coinlist-body">
          {coins.map((c) => {
            const ct = tickers[c.symbol]
            const cu = ct.changePct >= 0
            return (
              <button
                key={c.symbol}
                className={`ex-coin ${c.symbol === symbol ? 'active' : ''}`}
                onClick={() => {
                  track('Coin Selected', {
                    symbol: c.symbol,
                    coin_name: c.name,
                    location: 'exchange_sidebar',
                  })
                  navigate(`/trade/${c.symbol}`)
                }}
              >
                <span className="ex-coin-name">
                  <strong>{c.name}</strong>
                  <em>{c.symbol}</em>
                </span>
                <span className="ex-coin-price">
                  <span className={cu ? 'up' : 'down'}>{formatPrice(ct.price)}</span>
                  <em className={cu ? 'up' : 'down'}>{formatPct(ct.changePct)}</em>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* 중앙: 헤더 + 차트 + 미체결 */}
      <section className="ex-center">
        <div className="ex-header">
          <div className="ex-title">
            <span className="coin-dot lg" style={{ background: coin.color }}>
              {coin.symbol[0]}
            </span>
            <div>
              <h2>
                {coin.name} <span className="ticker">{coin.symbol}/KRW</span>
              </h2>
            </div>
          </div>
          <div className="ex-price-block">
            <span className={`ex-price ${up ? 'up' : 'down'}`}>{formatPrice(t.price)}</span>
            <span className={`ex-change ${up ? 'up' : 'down'}`}>
              {formatPct(t.changePct)} ({up ? '▲' : '▼'} {formatPrice(Math.abs(t.price - t.prevClose))})
            </span>
          </div>
          <div className="ex-stats">
            <div>
              <span>고가(24H)</span>
              <strong className="up">{formatPrice(t.high24)}</strong>
            </div>
            <div>
              <span>저가(24H)</span>
              <strong className="down">{formatPrice(t.low24)}</strong>
            </div>
            <div>
              <span>거래대금(24H)</span>
              <strong>{formatVolume(t.volume24)}</strong>
            </div>
          </div>
        </div>

        <CoinChart symbol={symbol} />

        <div className="ex-orders">
          <div className="ex-orders-head">
            <h3>미체결 주문</h3>
            <span className="muted">{openOrders.length}건 · 전체 {allOpen.length}건</span>
          </div>
          {openOrders.length === 0 ? (
            <div className="empty sm">이 코인의 미체결 주문이 없습니다.</div>
          ) : (
            <table className="order-table">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>유형</th>
                  <th className="num">가격</th>
                  <th className="num">수량</th>
                  <th className="num">주문시간</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openOrders.map((o) => (
                  <tr key={o.id}>
                    <td className={o.side === 'buy' ? 'up' : 'down'}>
                      {o.side === 'buy' ? '매수' : '매도'}
                    </td>
                    <td>{o.type === 'limit' ? '지정가' : '시장가'}</td>
                    <td className="num">{formatPrice(o.price)}</td>
                    <td className="num">{formatCoin(o.amount)}</td>
                    <td className="num">{formatTime(o.createdAt)}</td>
                    <td className="num">
                      <button className="btn-cancel" onClick={() => cancelOrder(o.id, 'exchange')}>
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 우측: 호가창 + 주문 */}
      <aside className="ex-right">
        <OrderBook symbol={symbol} onPickPrice={pickPrice} />
        <TradePanel symbol={symbol} pickedPrice={pickedPrice} />
      </aside>
    </div>
  )
}
