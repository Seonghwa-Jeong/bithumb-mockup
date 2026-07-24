/**
 * 시세 시뮬레이션 엔진
 * -------------------------------------------------
 * 실제 시세 API 대신, 각 코인의 기준가에서 랜덤 워크로 가격을 움직입니다.
 * - COINS: 상장 코인 목록 (기준가/변동성/한글명)
 * - createCandles(): 초기 캔들 히스토리 생성
 * - nextPrice(): 다음 틱 가격 계산
 * - buildOrderBook(): 현재가 기준 호가창 생성
 */

export const COINS = [
  { symbol: 'BTC', name: '비트코인', base: 95_000_000, vol: 0.012, color: '#f7931a' },
  { symbol: 'ETH', name: '이더리움', base: 5_100_000, vol: 0.016, color: '#627eea' },
  { symbol: 'XRP', name: '리플', base: 3_150, vol: 0.028, color: '#23292f' },
  { symbol: 'SOL', name: '솔라나', base: 285_000, vol: 0.03, color: '#14f195' },
  { symbol: 'DOGE', name: '도지코인', base: 520, vol: 0.045, color: '#c2a633' },
  { symbol: 'ADA', name: '에이다', base: 1_450, vol: 0.03, color: '#0033ad' },
  { symbol: 'TRX', name: '트론', base: 380, vol: 0.02, color: '#eb0029' },
  { symbol: 'AVAX', name: '아발란체', base: 62_000, vol: 0.035, color: '#e84142' },
  { symbol: 'LINK', name: '체인링크', base: 33_500, vol: 0.03, color: '#2a5ada' },
  { symbol: 'MATIC', name: '폴리곤', base: 780, vol: 0.04, color: '#8247e5' },
  { symbol: 'DOT', name: '폴카닷', base: 9_800, vol: 0.032, color: '#e6007a' },
  { symbol: 'ATOM', name: '코스모스', base: 8_400, vol: 0.033, color: '#2e3148' },
]

export const COIN_MAP = Object.fromEntries(COINS.map((c) => [c.symbol, c]))

// 가우시안 근사 난수 (Box-Muller 대신 합산 방식, 가벼움)
function gaussian() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2
}

/** 다음 틱 가격 — 평균 회귀가 살짝 섞인 랜덤 워크 */
export function nextPrice(price, coin) {
  const drift = (coin.base - price) / coin.base * 0.02 // 기준가로 약하게 회귀
  const shock = gaussian() * coin.vol
  const next = price * (1 + drift + shock)
  return Math.max(next, coin.base * 0.2)
}

/** 초기 캔들(분봉) 히스토리 생성 */
export function createCandles(coin, count = 60, endTime = Date.now()) {
  const candles = []
  let price = coin.base * (0.9 + Math.random() * 0.2)
  const interval = 60_000 // 1분
  for (let i = count - 1; i >= 0; i--) {
    const open = price
    let high = open
    let low = open
    // 캔들 내부 4틱으로 고가/저가 형성
    for (let t = 0; t < 4; t++) {
      price = nextPrice(price, coin)
      high = Math.max(high, price)
      low = Math.min(low, price)
    }
    const close = price
    candles.push({
      time: endTime - i * interval,
      open,
      high,
      low,
      close,
      volume: Math.random() * coin.base * 2,
    })
  }
  return candles
}

/** 24시간 등락률/거래대금 초기 스냅샷 */
export function initialTicker(coin) {
  const changePct = gaussian() * 6 // 대략 ±6% 범위
  const price = coin.base * (1 + changePct / 100)
  return {
    symbol: coin.symbol,
    price,
    prevClose: coin.base,
    changePct,
    high24: price * (1 + Math.random() * 0.04),
    low24: price * (1 - Math.random() * 0.04),
    volume24: coin.base * (500 + Math.random() * 5000),
  }
}

/**
 * 호가창 생성 — 현재가 기준 위/아래로 호가 단위만큼 벌려서 랜덤 수량 배치
 */
export function buildOrderBook(price, coin, depth = 10) {
  const tick = tickSize(price)
  const asks = [] // 매도호가 (현재가 위)
  const bids = [] // 매수호가 (현재가 아래)
  for (let i = 1; i <= depth; i++) {
    const askPrice = price + tick * i
    const bidPrice = price - tick * i
    asks.push({ price: askPrice, size: randomSize(coin) })
    bids.push({ price: bidPrice, size: randomSize(coin) })
  }
  return { asks: asks.reverse(), bids } // asks 는 높은가격이 위로
}

function randomSize(coin) {
  const notional = coin.base
  const krw = 500_000 + Math.random() * 30_000_000
  return krw / notional
}

/** 가격대별 호가 단위 (빗썸 유사) */
export function tickSize(price) {
  if (price >= 1_000_000) return 1000
  if (price >= 100_000) return 100
  if (price >= 10_000) return 10
  if (price >= 1_000) return 1
  if (price >= 100) return 0.1
  return 0.01
}
