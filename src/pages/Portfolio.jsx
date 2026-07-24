import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarket } from '../context/MarketContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { COIN_MAP } from '../lib/market.js'
import { TIERS, nextTier } from '../lib/tiers.js'
import { formatKRW, formatCoin, formatPrice, formatPct } from '../lib/format.js'
import { track } from '../lib/amplitude.js'

export default function Portfolio() {
  const { portfolio, tickers, totals, resetAccount } = useMarket()
  const { user } = useAuth()
  const navigate = useNavigate()

  const holdings = useMemo(() => {
    if (!portfolio) return []
    return Object.entries(portfolio.holdings)
      .filter(([, h]) => h.amount > 0)
      .map(([sym, h]) => {
        const price = tickers[sym]?.price || 0
        const value = price * h.amount
        const buyValue = h.avgBuy * h.amount
        const pnl = value - buyValue
        const pnlPct = buyValue > 0 ? (pnl / buyValue) * 100 : 0
        return { sym, coin: COIN_MAP[sym], ...h, price, value, buyValue, pnl, pnlPct }
      })
      .sort((a, b) => b.value - a.value)
  }, [portfolio, tickers])

  if (!portfolio) return null

  const up = totals.pnl >= 0
  const tierKey = user?.tier || 'WHITE'
  const tier = TIERS[tierKey]
  const nxt = nextTier(tierKey)
  const vol = user?.monthlyVolume ?? 0

  return (
    <div className="page">
      <div className="page-head">
        <h1>투자내역</h1>
        <button
          className="btn-ghost"
          onClick={() => {
            if (confirm('계좌를 초기 상태로 되돌립니다. 계속할까요?')) resetAccount()
          }}
        >
          계좌 초기화
        </button>
      </div>

      <div className="tier-card">
        <div className="tier-card-main">
          <span className={`tier tier-${tierKey.toLowerCase()} lg`}>{tier.label}</span>
          <div className="tc-name">
            <strong>{user?.nickname} 님의 등급</strong>
            <span>전월 거래금액 {formatKRW(vol)} 기준</span>
          </div>
        </div>
        <div className="tier-benefits">
          <div>
            <span>거래포인트</span>
            <strong>{tier.tradePointPct}%</strong>
          </div>
          <div>
            <span>메이커 리워드</span>
            <strong>{tier.makerRewardPct ? `${tier.makerRewardPct}%` : '—'}</strong>
          </div>
          <div>
            <span>{nxt ? `다음 등급 · ${nxt.label}` : '최고 등급'}</span>
            <strong>{nxt ? `${formatKRW(nxt.minVolume - vol)} 남음` : '달성 🎉'}</strong>
          </div>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <span className="sc-label">총 보유자산</span>
          <strong className="sc-value">{formatKRW(totals.totalValue)}</strong>
        </div>
        <div className="summary-card">
          <span className="sc-label">보유 KRW</span>
          <strong className="sc-value">{formatKRW(portfolio.krw)}</strong>
          {portfolio.krwInOrder > 0 && (
            <span className="sc-sub">주문중 {formatKRW(portfolio.krwInOrder)}</span>
          )}
        </div>
        <div className="summary-card">
          <span className="sc-label">총 코인 평가</span>
          <strong className="sc-value">{formatKRW(totals.coinValue)}</strong>
        </div>
        <div className="summary-card">
          <span className="sc-label">총 평가손익</span>
          <strong className={`sc-value ${up ? 'up' : 'down'}`}>
            {up ? '+' : ''}
            {formatKRW(totals.pnl)}
          </strong>
          <span className={`sc-sub ${up ? 'up' : 'down'}`}>{formatPct(totals.pnlPct)}</span>
        </div>
      </div>

      <div className="table-card">
        <h3>보유 코인</h3>
        {holdings.length === 0 ? (
          <div className="empty">
            보유한 코인이 없습니다.{' '}
            <button
              className="link-btn"
              onClick={() => {
                track('Empty State CTA Clicked', { destination: 'market', location: 'portfolio' })
                navigate('/market')
              }}
            >
              거래하러 가기 →
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>보유자산</th>
                <th className="num">보유수량</th>
                <th className="num">매수평균가</th>
                <th className="num">현재가</th>
                <th className="num">평가금액</th>
                <th className="num">평가손익</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const hu = h.pnl >= 0
                return (
                  <tr key={h.sym}>
                    <td>
                      <div className="cell-coin">
                        <span className="coin-dot sm" style={{ background: h.coin.color }}>
                          {h.sym[0]}
                        </span>
                        <div>
                          <strong>{h.coin.name}</strong>
                          <span className="ticker">{h.sym}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num">{formatCoin(h.amount)}</td>
                    <td className="num">{formatPrice(h.avgBuy)}</td>
                    <td className="num">{formatPrice(h.price)}</td>
                    <td className="num">{formatKRW(h.value)}</td>
                    <td className={`num ${hu ? 'up' : 'down'}`}>
                      {hu ? '+' : ''}
                      {formatKRW(h.pnl)}
                      <br />
                      <em>{formatPct(h.pnlPct)}</em>
                    </td>
                    <td className="num">
                      <button
                        className="btn-mini"
                        onClick={() => {
                          track('Coin Selected', {
                            symbol: h.sym,
                            coin_name: h.coin.name,
                            holding_value_krw: Math.round(h.value),
                            pnl_pct: Number(h.pnlPct.toFixed(2)),
                            location: 'portfolio_holdings',
                          })
                          navigate(`/trade/${h.sym}`)
                        }}
                      >
                        거래
                      </button>
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
