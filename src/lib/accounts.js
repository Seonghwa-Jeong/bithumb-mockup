/**
 * 하드코딩된 테스트 계정 (클라이언트 전용, 실제 인증 아님)
 * 로그인 화면에 "테스트 계정으로 로그인" 버튼으로 노출됩니다.
 * 등급(tier)은 전월 거래금액(monthlyVolume)으로 자동 산정됩니다. → src/lib/tiers.js
 */
import { tierForVolume } from './tiers.js'

function withTier(a) {
  return { ...a, tier: tierForVolume(a.monthlyVolume) }
}

export const TEST_ACCOUNTS = [
  withTier({
    id: 'trader01',
    email: 'trader01@bithumb.test',
    password: 'test1234',
    nickname: '고래투자자',
    krw: 50_000_000, // 초기 원화 잔고
    monthlyVolume: 1_500_000_000, // 전월 거래금액 15억 → 퍼플
  }),
  withTier({
    id: 'newbie',
    email: 'newbie@bithumb.test',
    password: 'test1234',
    nickname: '코린이',
    krw: 1_000_000,
    monthlyVolume: 3_000_000, // 전월 거래금액 300만 → 화이트
  }),
  withTier({
    id: 'hodler',
    email: 'hodler@bithumb.test',
    password: 'test1234',
    nickname: '존버마스터',
    krw: 10_000_000,
    monthlyVolume: 250_000_000, // 전월 거래금액 2.5억 → 그린
  }),
]

export function findAccount(emailOrId, password) {
  return TEST_ACCOUNTS.find(
    (a) => (a.email === emailOrId || a.id === emailOrId) && a.password === password,
  )
}
