/**
 * 하드코딩된 테스트 계정 (클라이언트 전용, 실제 인증 아님)
 * 로그인 화면에 "테스트 계정으로 로그인" 버튼으로 노출됩니다.
 */
export const TEST_ACCOUNTS = [
  {
    id: 'trader01',
    email: 'trader01@bithumb.test',
    password: 'test1234',
    nickname: '고래투자자',
    krw: 50_000_000, // 초기 원화 잔고
    tier: 'VIP',
  },
  {
    id: 'newbie',
    email: 'newbie@bithumb.test',
    password: 'test1234',
    nickname: '코린이',
    krw: 1_000_000,
    tier: 'BASIC',
  },
  {
    id: 'hodler',
    email: 'hodler@bithumb.test',
    password: 'test1234',
    nickname: '존버마스터',
    krw: 10_000_000,
    tier: 'GOLD',
  },
]

export function findAccount(emailOrId, password) {
  return TEST_ACCOUNTS.find(
    (a) => (a.email === emailOrId || a.id === emailOrId) && a.password === password,
  )
}
