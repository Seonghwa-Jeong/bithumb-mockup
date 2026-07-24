import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useMarket } from '../context/MarketContext.jsx'
import { formatKRW } from '../lib/format.js'
import { TIERS } from '../lib/tiers.js'
import { track } from '../lib/amplitude.js'

const NAV = [
  { to: '/market', label: '거래소' },
  { to: '/portfolio', label: '투자내역' },
  { to: '/orders', label: '거래내역' },
  { to: '/wallet', label: '입출금' },
]

export default function Header() {
  const { user, logout } = useAuth()
  const { totals } = useMarket()
  const navigate = useNavigate()

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <button
            className="logo"
            onClick={() => {
              track('Logo Clicked', { location: 'global_header' })
              navigate('/market')
            }}
            aria-label="홈으로"
          >
            <span className="logo-mark">B</span>
            <span className="logo-text">bithumb</span>
            <span className="logo-badge">mock</span>
          </button>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                onClick={() =>
                  track('Nav Item Clicked', { destination: n.label, location: 'global_header' })
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="header-right">
          {user ? (
            <>
              <div className="total-asset">
                <span className="total-asset-label">총 보유자산</span>
                <span className="total-asset-value">{formatKRW(totals.totalValue)}</span>
              </div>
              <div className="user-chip">
                <span className={`tier tier-${user.tier?.toLowerCase()}`}>
                  {TIERS[user.tier]?.label || user.tier}
                </span>
                <span className="nickname">{user.nickname}</span>
              </div>
              <button className="btn-ghost" onClick={logout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-ghost"
                onClick={() => {
                  track('Auth CTA Clicked', { cta: 'login', location: 'global_header' })
                  navigate('/login')
                }}
              >
                로그인
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  track('Auth CTA Clicked', { cta: 'signup', location: 'global_header' })
                  navigate('/signup')
                }}
              >
                회원가입
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
