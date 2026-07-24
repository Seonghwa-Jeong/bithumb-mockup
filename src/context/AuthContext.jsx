import { createContext, useContext, useEffect, useState } from 'react'
import { findAccount, TEST_ACCOUNTS } from '../lib/accounts.js'
import { identifyUser, resetUser, track, getPayload } from '../lib/amplitude.js'

const AuthContext = createContext(null)
const STORAGE_KEY = 'bithumb_auth_user'
const USERS_KEY = 'bithumb_signup_users' // 회원가입으로 추가된 계정
const SESSION_IDLE_MS = 30 * 60 * 1000 // 무동작 30분 → 세션 타임아웃 (데모용, 조정 가능)

function loadSignupUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || []
  } catch {
    return []
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null
    } catch {
      return null
    }
  })

  // 유저 세션 유지 + Amplitude 식별
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      identifyUser(user.id, {
        nickname: user.nickname,
        tier: user.tier,
        monthly_trade_volume_krw: user.monthlyVolume ?? 0,
        signup_source: user.source || 'test_account',
      })
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  function login(emailOrId, password) {
    // 1) 하드코딩 테스트 계정
    let acc = findAccount(emailOrId, password)
    // 2) 회원가입으로 만든 계정
    if (!acc) {
      acc = loadSignupUsers().find(
        (a) => (a.email === emailOrId || a.id === emailOrId) && a.password === password,
      )
    }
    if (!acc) {
      track('Login Failed', {
        method: 'password',
        failure_reason: 'invalid_credentials',
        location: 'login_page',
      })
      return { ok: false, error: '이메일(또는 아이디)/비밀번호가 올바르지 않습니다.' }
    }
    const { password: _pw, ...safe } = acc
    setUser(safe)
    track('Login Succeeded', { method: 'password', user_tier: safe.tier, location: 'login_page' })
    return { ok: true }
  }

  function loginWithTestAccount(id) {
    const acc = TEST_ACCOUNTS.find((a) => a.id === id)
    if (!acc) return { ok: false, error: '계정을 찾을 수 없습니다.' }
    const { password: _pw, ...safe } = acc
    setUser(safe)
    track('Login Succeeded', {
      method: 'test_account_quick',
      user_tier: safe.tier,
      location: 'login_page',
    })
    return { ok: true }
  }

  function signup({ email, nickname, password }) {
    const users = loadSignupUsers()
    const exists =
      users.some((u) => u.email === email) ||
      TEST_ACCOUNTS.some((a) => a.email === email)
    if (exists) {
      track('Signup Failed', { failure_reason: 'email_exists', location: 'signup_page' })
      return { ok: false, error: '이미 가입된 이메일입니다.' }
    }
    // Remote config: 신규 가입 축하금을 원격에서 제어 (재배포 없이 금액 실험)
    const welcomeBonus = getPayload('welcome-bonus', { amount_krw: 1_000_000 }).amount_krw
    const newUser = {
      id: `user_${Date.now()}`,
      email,
      nickname,
      password,
      krw: welcomeBonus, // 신규 가입 축하금 (remote config)
      monthlyVolume: 0, // 신규 → 전월 거래금액 0 → 화이트
      tier: 'WHITE',
      source: 'signup',
    }
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]))
    const { password: _pw, ...safe } = newUser
    setUser(safe)
    track('Signup Completed', {
      user_tier: 'WHITE',
      welcome_bonus_krw: welcomeBonus,
      location: 'signup_page',
    })
    return { ok: true }
  }

  function logout(reason = 'manual') {
    track('Logout', {
      reason,
      location: reason === 'session_timeout' ? 'session_timeout' : 'global_header',
    })
    resetUser() // identity 초기화 + Experiment 재평가(익명)
    setUser(null)
  }

  // 세션 타임아웃(무동작) — 로그인 상태에서만 감시
  useEffect(() => {
    if (!user) return
    let timer
    const onTimeout = () => {
      track('Session Timeout', { idle_minutes: SESSION_IDLE_MS / 60000, user_tier: user.tier })
      logout('session_timeout')
    }
    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(onTimeout, SESSION_IDLE_MS)
    }
    const activity = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange']
    activity.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      clearTimeout(timer)
      activity.forEach((e) => window.removeEventListener(e, resetTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <AuthContext.Provider
      value={{ user, login, loginWithTestAccount, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
