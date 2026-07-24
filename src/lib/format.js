/** 숫자/통화 포맷 유틸 */

export function formatKRW(value, { withUnit = true } = {}) {
  if (value == null || isNaN(value)) return '-'
  const rounded = Math.round(value)
  const s = rounded.toLocaleString('ko-KR')
  return withUnit ? `${s}원` : s
}

/** 코인 가격: 1000 이상은 정수, 미만은 소수점 표시 */
export function formatPrice(value) {
  if (value == null || isNaN(value)) return '-'
  if (value >= 1000) return Math.round(value).toLocaleString('ko-KR')
  if (value >= 1) return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
}

/** 코인 수량 (최대 8자리) */
export function formatCoin(value) {
  if (value == null || isNaN(value)) return '0'
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 8 })
}

export function formatPct(value) {
  if (value == null || isNaN(value)) return '0.00%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 큰 거래대금을 조/억/만 단위로 축약 */
export function formatVolume(value) {
  if (value == null || isNaN(value)) return '-'
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`
  if (value >= 1e8) return `${Math.round(value / 1e8).toLocaleString('ko-KR')}억`
  if (value >= 1e4) return `${Math.round(value / 1e4).toLocaleString('ko-KR')}만`
  return Math.round(value).toLocaleString('ko-KR')
}

export function formatTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function formatDateTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
