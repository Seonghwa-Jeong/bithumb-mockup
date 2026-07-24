import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { track, getPayload } from '../lib/amplitude.js'
import { formatKRW } from '../lib/format.js'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', nickname: '', password: '', confirm: '', agree: false })
  const [error, setError] = useState('')

  // Remote config: 웰컴 보너스 금액 (AuthContext.signup 과 동일 플래그)
  const welcomeBonus = getPayload('welcome-bonus', { amount_krw: 1_000_000 }).amount_krw

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.email || !form.nickname || !form.password) {
      setError('모든 항목을 입력하세요.')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!form.agree) {
      setError('약관에 동의해주세요.')
      return
    }
    track('Signup Started', { location: 'signup_page' })
    const res = signup({ email: form.email.trim(), nickname: form.nickname.trim(), password: form.password })
    if (res.ok) navigate('/market', { replace: true })
    else setError(res.error)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo-mark lg">B</span>
          <h1>회원가입</h1>
        </div>
        <p className="auth-headline">가입하면 실습용 원화 {formatKRW(welcomeBonus)}을 드려요</p>

        <form onSubmit={submit} className="auth-form">
          <label>
            이메일
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            닉네임
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => set('nickname', e.target.value)}
              placeholder="거래소에서 사용할 이름"
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="6자 이상"
            />
          </label>
          <label>
            비밀번호 확인
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => set('agree', e.target.checked)}
            />
            <span>[필수] 서비스 이용약관 및 개인정보 처리방침에 동의합니다. (목업)</span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary lg">
            가입하고 시작하기
          </button>
        </form>

        <p className="auth-switch">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}
