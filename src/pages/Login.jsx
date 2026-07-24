import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { TEST_ACCOUNTS } from '../lib/accounts.js'
import { TIERS } from '../lib/tiers.js'
import { getVariant, track } from '../lib/amplitude.js'
import { formatKRW } from '../lib/format.js'

export default function Login() {
  const { login, loginWithTestAccount } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/market'

  const [emailOrId, setEmailOrId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Amplitude Experiment 데모: 로그인 헤드라인 문구 A/B
  const headlineVariant = getVariant('login-headline', 'control')
  const headline =
    headlineVariant === 'treatment'
      ? '지금 시작하면 신규 혜택까지'
      : '대한민국 대표 디지털 자산 거래소'

  function submit(e) {
    e.preventDefault()
    setError('')
    const res = login(emailOrId.trim(), password)
    if (res.ok) navigate(from, { replace: true })
    else setError(res.error)
  }

  function quickLogin(id) {
    const res = loginWithTestAccount(id)
    if (res.ok) navigate(from, { replace: true })
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo-mark lg">B</span>
          <h1>bithumb</h1>
        </div>
        <p className="auth-headline">{headline}</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            이메일 또는 아이디
            <input
              type="text"
              value={emailOrId}
              onChange={(e) => setEmailOrId(e.target.value)}
              placeholder="trader01@bithumb.test"
              autoComplete="username"
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="test1234"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary lg">
            로그인
          </button>
        </form>

        <p className="auth-switch">
          아직 회원이 아니신가요? <Link to="/signup">회원가입</Link>
        </p>

        <div className="test-accounts">
          <div className="divider">
            <span>테스트 계정으로 바로 로그인</span>
          </div>
          <div className="test-account-grid">
            {TEST_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                className="test-account"
                onClick={() => quickLogin(a.id)}
              >
                <span className={`tier tier-${a.tier.toLowerCase()}`}>
                  {TIERS[a.tier]?.label || a.tier}
                </span>
                <strong>{a.nickname}</strong>
                <span className="ta-id">{a.email}</span>
                <span className="ta-krw">보유원화 {formatKRW(a.krw)}</span>
              </button>
            ))}
          </div>
          <p className="test-hint">
            모든 계정 비밀번호: <code>test1234</code> · 데이터는 브라우저에만 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}
