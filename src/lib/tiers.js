/**
 * 빗썸 회원 등급 제도 (전월 1일~말일 거래금액 합산 기준)
 * -------------------------------------------------------------
 * tradePointPct  : 거래포인트 적립률 (%)
 * makerRewardPct : 메이커 리워드 (%) — 0 이면 해당 없음
 * minVolume      : 해당 등급의 전월 거래금액 하한 (KRW)
 */
export const TIER_ORDER = ['WHITE', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'BLACK']

export const TIERS = {
  WHITE: { key: 'WHITE', label: '화이트', minVolume: 0, tradePointPct: 0.003, makerRewardPct: 0 },
  BLUE: { key: 'BLUE', label: '블루', minVolume: 10_000_000, tradePointPct: 0.005, makerRewardPct: 0 },
  GREEN: { key: 'GREEN', label: '그린', minVolume: 100_000_000, tradePointPct: 0.008, makerRewardPct: 0 },
  PURPLE: {
    key: 'PURPLE',
    label: '퍼플',
    minVolume: 1_000_000_000,
    tradePointPct: 0.01,
    makerRewardPct: 0.005,
  },
  ORANGE: {
    key: 'ORANGE',
    label: '오렌지',
    minVolume: 10_000_000_000,
    tradePointPct: 0.01,
    makerRewardPct: 0.008,
  },
  BLACK: {
    key: 'BLACK',
    label: '블랙',
    minVolume: 100_000_000_000,
    tradePointPct: 0.01,
    makerRewardPct: 0.01,
  },
}

/** 전월 거래금액(KRW)으로 등급 키를 산정 */
export function tierForVolume(volume = 0) {
  let key = 'WHITE'
  for (const k of TIER_ORDER) {
    if (volume >= TIERS[k].minVolume) key = k
  }
  return key
}

/** 다음 등급 정보 (최고 등급이면 null) */
export function nextTier(key) {
  const i = TIER_ORDER.indexOf(key)
  if (i < 0 || i === TIER_ORDER.length - 1) return null
  return TIERS[TIER_ORDER[i + 1]]
}
