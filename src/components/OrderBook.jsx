import { useEffect, useMemo, useState } from 'react'
import { useMarket } from '../context/MarketContext.jsx'
import { COIN_MAP, buildOrderBook } from '../lib/market.js'
import { formatPrice, formatPct } from '../lib/format.js'

/** 호가창 — 현재가 기준으로 매도/매수 호가를 표시. 호가 클릭 시 가격 선택 */
export default function OrderBook({ symbol, onPickPrice }) {
  const { tickers } = useMarket()
  const coin = COIN_MAP[symbol]
  const t = tickers[symbol]
  const [book, setBook] = useState(() => buildOrderBook(t.price, coin))

  // 가격이 바뀔 때마다 호가를 다시 구성 (수량은 매 갱신마다 살짝 변동)
  useEffect(() => {
    setBook(buildOrderBook(t.price, coin))
  }, [t.price, symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  const maxSize = useMemo(() => {
    const all = [...book.asks, ...book.bids].map((r) => r.size)
    return Math.max(...all, 1)
  }, [book])

  const change = (p) => ((p - t.prevClose) / t.prevClose) * 100

  return (
    <div className="orderbook">
      <div className="ob-head">
        <span>매도잔량</span>
        <span>가격(KRW)</span>
      </div>
      <div className="ob-asks">
        {book.asks.map((r, i) => (
          <button key={`a${i}`} className="ob-row ask" onClick={() => onPickPrice(r.price)}>
            <span className="ob-size">
              <span className="ob-bar ask-bar" style={{ width: `${(r.size / maxSize) * 100}%` }} />
              {r.size.toFixed(4)}
            </span>
            <span className="ob-price down">
              {formatPrice(r.price)}
              <em>{formatPct(change(r.price))}</em>
            </span>
          </button>
        ))}
      </div>

      <div className="ob-mid">
        <strong className={t.changePct >= 0 ? 'up' : 'down'}>{formatPrice(t.price)}</strong>
        <span className={t.changePct >= 0 ? 'up' : 'down'}>{formatPct(t.changePct)}</span>
      </div>

      <div className="ob-bids">
        {book.bids.map((r, i) => (
          <button key={`b${i}`} className="ob-row bid" onClick={() => onPickPrice(r.price)}>
            <span className="ob-price up">
              {formatPrice(r.price)}
              <em>{formatPct(change(r.price))}</em>
            </span>
            <span className="ob-size">
              <span className="ob-bar bid-bar" style={{ width: `${(r.size / maxSize) * 100}%` }} />
              {r.size.toFixed(4)}
            </span>
          </button>
        ))}
      </div>
      <div className="ob-foot">
        <span>가격(KRW)</span>
        <span>매수잔량</span>
      </div>
    </div>
  )
}
