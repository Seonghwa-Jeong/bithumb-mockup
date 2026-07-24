import { useMemo, useState } from 'react'
import { useMarket } from '../context/MarketContext.jsx'
import { COIN_MAP } from '../lib/market.js'
import { formatPrice, formatCoin, formatKRW, formatDateTime } from '../lib/format.js'
import { track } from '../lib/amplitude.js'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '미체결' },
  { key: 'filled', label: '체결' },
  { key: 'canceled', label: '취소' },
]

const STATUS_LABEL = {
  pending: '미체결',
  filled: '체결완료',
  canceled: '취소',
}

export default function Orders() {
  const { portfolio, cancelOrder } = useMarket()
  const [filter, setFilter] = useState('all')

  const rows = useMemo(() => {
    if (!portfolio) return []
    const open = portfolio.openOrders.map((o) => ({ ...o, status: 'pending' }))
    const combined = [...open, ...portfolio.history].sort(
      (a, b) => (b.filledAt || b.createdAt) - (a.filledAt || a.createdAt),
    )
    if (filter === 'all') return combined
    if (filter === 'open') return combined.filter((o) => o.status === 'pending')
    return combined.filter((o) => o.status === filter)
  }, [portfolio, filter])

  if (!portfolio) return null

  function changeFilter(key) {
    setFilter(key)
    track('Orders Filter Changed', { filter: key, location: 'orders' })
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>거래내역</h1>
      </div>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'filter-tab active' : 'filter-tab'}
            onClick={() => changeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-card">
        {rows.length === 0 ? (
          <div className="empty">거래내역이 없습니다.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>자산</th>
                <th>구분</th>
                <th>유형</th>
                <th className="num">가격</th>
                <th className="num">수량</th>
                <th className="num">금액</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const coin = COIN_MAP[o.symbol]
                const price = o.status === 'filled' ? o.fillPrice : o.price
                const notional = price * o.amount
                return (
                  <tr key={o.id}>
                    <td className="muted">{formatDateTime(o.filledAt || o.createdAt)}</td>
                    <td>
                      <div className="cell-coin">
                        <span className="coin-dot sm" style={{ background: coin?.color }}>
                          {o.symbol[0]}
                        </span>
                        <strong>{o.symbol}</strong>
                      </div>
                    </td>
                    <td className={o.side === 'buy' ? 'up' : 'down'}>
                      {o.side === 'buy' ? '매수' : '매도'}
                    </td>
                    <td>{o.type === 'limit' ? '지정가' : '시장가'}</td>
                    <td className="num">{formatPrice(price)}</td>
                    <td className="num">{formatCoin(o.amount)}</td>
                    <td className="num">{formatKRW(notional)}</td>
                    <td>
                      <span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="num">
                      {o.status === 'pending' && (
                        <button className="btn-cancel" onClick={() => cancelOrder(o.id, 'orders')}>
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
