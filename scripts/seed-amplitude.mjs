/**
 * Amplitude 시드 데이터 생성기
 * -------------------------------------------------------------------------
 * 이 앱에 태그된 이벤트를 기반으로 자연스러운 사용자 플로우(시나리오)를 시뮬레이션해
 * Amplitude HTTP Batch API 로 대량 전송합니다.
 *
 *   node scripts/seed-amplitude.mjs --users 500          # 전송
 *   node scripts/seed-amplitude.mjs --users 5 --dry-run  # 전송 없이 통계/샘플만
 *   node scripts/seed-amplitude.mjs --users 20 --max 300 # 최대 300개만 전송(검증용)
 *
 * API 키는 .env.local(VITE_AMPLITUDE_API_KEY) 또는 환경변수 AMPLITUDE_API_KEY 에서 읽습니다.
 * 기간: 2026-06-01 ~ 2026-08-31 (KST). insert_id 로 이벤트 단위 멱등 처리.
 * -------------------------------------------------------------------------
 */
import fs from 'node:fs'

// ---------- 설정 ----------
const args = parseArgs(process.argv.slice(2))
const N_USERS = args.users ?? 500
const DRY_RUN = !!args['dry-run']
const MAX_EVENTS = args.max ?? Infinity
const CHUNK = 500
const ENDPOINT = 'https://api2.amplitude.com/batch'
const START = Date.parse('2026-06-01T00:00:00+09:00')
const END = Date.parse('2026-08-31T23:59:59+09:00')
const DAY = 86_400_000

const API_KEY = readApiKey()

// ---------- 코인 (app/market.js 와 동일) ----------
const COINS = [
  { s: 'BTC', n: '비트코인', p: 95_000_000 },
  { s: 'ETH', n: '이더리움', p: 5_100_000 },
  { s: 'XRP', n: '리플', p: 3_150 },
  { s: 'SOL', n: '솔라나', p: 285_000 },
  { s: 'DOGE', n: '도지코인', p: 520 },
  { s: 'ADA', n: '에이다', p: 1_450 },
  { s: 'TRX', n: '트론', p: 380 },
  { s: 'AVAX', n: '아발란체', p: 62_000 },
  { s: 'LINK', n: '체인링크', p: 33_500 },
  { s: 'MATIC', n: '폴리곤', p: 780 },
  { s: 'DOT', n: '폴카닷', p: 9_800 },
  { s: 'ATOM', n: '코스모스', p: 8_400 },
]
const FEE_RATE = 0.0004

// 등급 (app/tiers.js 와 동일)
const TIER_ORDER = ['WHITE', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'BLACK']
const TIER_MIN = {
  WHITE: 0,
  BLUE: 10_000_000,
  GREEN: 100_000_000,
  PURPLE: 1_000_000_000,
  ORANGE: 10_000_000_000,
  BLACK: 100_000_000_000,
}
function tierFor(vol) {
  let k = 'WHITE'
  for (const t of TIER_ORDER) if (vol >= TIER_MIN[t]) k = t
  return k
}

// 실험 플래그 & 변형
const FLAGS = {
  'login-headline': ['control', 'treatment'],
  'buy-cta': ['control', 'treatment'],
  'welcome-bonus': ['control', 'treatment'],
  'market-hero': ['control', 'treatment'],
}
const WELCOME_BONUS = { control: 1_000_000, treatment: 2_000_000 }

// ---------- 유틸 ----------
function parseArgs(a) {
  const o = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2)
      const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true
      o[k] = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v
    }
  }
  return o
}
function readApiKey() {
  if (process.env.AMPLITUDE_API_KEY) return process.env.AMPLITUDE_API_KEY
  try {
    const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const m = txt.match(/VITE_AMPLITUDE_API_KEY\s*=\s*(.+)/)
    if (m) return m[1].trim()
  } catch {
    /* ignore */
  }
  throw new Error('API 키를 찾을 수 없습니다. .env.local 또는 AMPLITUDE_API_KEY 를 설정하세요.')
}
const rnd = Math.random
const ri = (min, max) => Math.floor(min + rnd() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const chance = (p) => rnd() < p
const round = (n) => Math.round(n)

let SEQ = 0

// 시간대 가중(주간/저녁 활동 ↑) 시각 생성
function timeOfDay(dayMs) {
  const hourWeights = [1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 7, 7, 7, 6, 6, 7, 8, 9, 10, 9, 7, 4, 2]
  const total = hourWeights.reduce((a, b) => a + b, 0)
  let r = rnd() * total
  let h = 0
  for (; h < 24; h++) {
    r -= hourWeights[h]
    if (r <= 0) break
  }
  return dayMs + h * 3600_000 + ri(0, 59) * 60_000 + ri(0, 59) * 1000
}
function dayStart(ms) {
  return ms - (ms % DAY)
}

// ---------- 이벤트 빌드 ----------
const DEVICES = [
  { platform: 'Web', os: 'Chrome', dm: 'Mac' },
  { platform: 'Web', os: 'Chrome', dm: 'Windows' },
  { platform: 'Web', os: 'Safari', dm: 'iPhone' },
  { platform: 'Web', os: 'Samsung Internet', dm: 'Android' },
  { platform: 'Web', os: 'Edge', dm: 'Windows' },
]
const CITIES = [
  ['Seoul', 'Seoul'],
  ['Gyeonggi-do', 'Suwon'],
  ['Busan', 'Busan'],
  ['Incheon', 'Incheon'],
  ['Daegu', 'Daegu'],
]

const ALL_EVENTS = []
function buildEvent(u, type, time, props, sid, userProps) {
  const [region, city] = u.geo
  const e = {
    device_id: u.deviceId,
    event_type: type,
    time: Math.floor(time),
    session_id: Math.floor(sid),
    insert_id: `${u.deviceId}-${SEQ++}`,
    platform: u.dev.platform,
    os_name: u.dev.os,
    device_model: u.dev.dm,
    country: 'South Korea',
    region,
    city,
    language: 'Korean',
    app_version: '1.0.0',
    event_properties: props || {},
  }
  if (u.userId) e.user_id = u.userId
  if (userProps) e.user_properties = userProps
  ALL_EVENTS.push(e)
  return e
}

// 세션 헬퍼 — 이벤트마다 자연스러운 시간 간격
function session(u, startMs) {
  return { u, sid: startMs, t: startMs }
}
function emit(s, type, props = {}, gap = [4, 45], userProps = null) {
  s.t += ri(gap[0], gap[1]) * 1000
  return buildEvent(s.u, type, s.t, props, s.sid, userProps)
}
function pageView(s, path) {
  emit(
    s,
    '[Amplitude] Page Viewed',
    {
      '[Amplitude] Page Domain': 'seonghwa-jeong.github.io',
      '[Amplitude] Page Path': `/bithumb-mockup${path}`,
      '[Amplitude] Page URL': `https://seonghwa-jeong.github.io/bithumb-mockup${path}`,
    },
    [2, 15],
  )
}
function exposure(s, flag) {
  emit(s, '$exposure', { flag_key: flag, variant: s.u.variants[flag] }, [1, 4])
}
function userProps(u) {
  return {
    nickname: u.nickname,
    tier: u.tier,
    monthly_trade_volume_krw: round(u.volume),
    signup_source: u.source,
  }
}

// ---------- 도메인 동작(빌딩 블록) ----------
function coinPick() {
  // BTC/ETH 선호 가중
  return chance(0.6) ? pick([COINS[0], COINS[1], COINS[2], COINS[3]]) : pick(COINS)
}

function doAnonBrowse(s) {
  pageView(s, '/market')
  if (chance(0.7)) exposure(s, 'market-hero')
  if (chance(0.6)) emit(s, 'Market Sorted', { sort_key: pick(['price', 'changePct', 'volume24']), direction: pick(['asc', 'desc']), location: 'market_list' })
  if (chance(0.3)) emit(s, 'Market Tab Changed', { tab: pick(['all', 'fav']), location: 'market_list' })
  const views = ri(1, 4)
  for (let i = 0; i < views; i++) {
    const c = coinPick()
    emit(s, 'Coin Selected', { symbol: c.s, coin_name: c.n, list_rank: ri(1, 12), search_active: chance(0.2), location: 'market_list' })
    pageView(s, `/trade/${c.s}`)
    if (chance(0.4)) emit(s, 'Orderbook Price Selected', { symbol: c.s, coin_name: c.n, price: round(c.p * (1 + (rnd() - 0.5) * 0.01)), location: 'exchange_orderbook' })
  }
}

function doPromoOrHeaderAuth(s, cta) {
  if (chance(0.5)) {
    exposure(s, 'market-hero')
    emit(s, 'Promo CTA Clicked', { cta, location: 'market_hero' })
  } else {
    emit(s, 'Auth CTA Clicked', { cta, location: 'global_header' })
  }
}

function doSignup(s, success) {
  doPromoOrHeaderAuth(s, 'signup')
  pageView(s, '/signup')
  exposure(s, 'welcome-bonus')
  emit(s, 'Signup Started', { location: 'signup_page' })
  if (!success) {
    emit(s, 'Signup Failed', { failure_reason: pick(['email_exists', 'weak_password']), location: 'signup_page' })
    return false
  }
  const u = s.u
  u.userId = `seed_user_${u.idx.toString().padStart(5, '0')}`
  u.source = 'signup'
  u.tier = 'WHITE'
  const bonus = WELCOME_BONUS[u.variants['welcome-bonus']]
  u.krw += bonus
  emit(s, 'Signup Completed', { user_tier: 'WHITE', welcome_bonus_krw: bonus, location: 'signup_page' }, [5, 30], userProps(u))
  return true
}

function doLogin(s, success) {
  pageView(s, '/login')
  exposure(s, 'login-headline')
  if (chance(0.4)) emit(s, 'Auth CTA Clicked', { cta: 'login', location: 'global_header' })
  const fails = success ? ri(0, 1) : ri(1, 3)
  for (let i = 0; i < fails; i++) emit(s, 'Login Failed', { method: 'password', failure_reason: 'invalid_credentials', location: 'login_page' })
  if (success) {
    emit(s, 'Login Succeeded', { method: chance(0.15) ? 'test_account_quick' : 'password', user_tier: s.u.tier, location: 'login_page' }, [3, 20], userProps(s.u))
    return true
  }
  return false
}

function doDeposit(s) {
  const u = s.u
  if (chance(0.6)) emit(s, 'Nav Item Clicked', { destination: '입출금', location: 'global_header' })
  pageView(s, '/wallet')
  emit(s, 'Wallet Mode Changed', { mode: 'deposit', location: 'wallet' })
  const clicks = ri(1, 3)
  let amount = 0
  for (let i = 0; i < clicks; i++) {
    const q = pick([100_000, 500_000, 1_000_000, 5_000_000])
    amount += q
    emit(s, 'Wallet Quick Amount Clicked', { amount: q, mode: 'deposit', location: 'wallet' })
  }
  u.krw += amount
  emit(s, 'Wallet Deposit Completed', { asset: 'KRW', amount, balance_after: round(u.krw), location: 'wallet' })
}

function doWithdraw(s, success) {
  const u = s.u
  pageView(s, '/wallet')
  emit(s, 'Wallet Mode Changed', { mode: 'withdraw', location: 'wallet' })
  const amount = pick([100_000, 500_000, 1_000_000])
  if (success && u.krw >= amount) {
    u.krw -= amount
    emit(s, 'Wallet Withdraw Completed', { asset: 'KRW', amount, balance_after: round(u.krw), location: 'wallet' })
  } else {
    emit(s, 'Wallet Withdraw Failed', { asset: 'KRW', amount, failure_reason: 'insufficient_balance', location: 'wallet' })
  }
}

// 매수: outcome = 'fill' | 'cancel' | 'fail'
function doBuy(s, orderType, outcome) {
  const u = s.u
  const c = coinPick()
  emit(s, 'Coin Selected', { symbol: c.s, coin_name: c.n, location: chance(0.5) ? 'market_list' : 'exchange_sidebar' })
  pageView(s, `/trade/${c.s}`)
  exposure(s, 'buy-cta')
  emit(s, 'Order Side Changed', { symbol: c.s, side: 'buy', location: 'exchange_trade_panel' })
  emit(s, 'Order Type Changed', { symbol: c.s, order_type: orderType, location: 'exchange_trade_panel' })
  const price = round(c.p * (1 + (rnd() - 0.5) * 0.012))
  if (orderType === 'limit') emit(s, 'Orderbook Price Selected', { symbol: c.s, coin_name: c.n, price, location: 'exchange_orderbook' })
  const pct = pick([10, 25, 50, 100])
  emit(s, 'Order Ratio Clicked', { symbol: c.s, side: 'buy', percent: pct, order_type: orderType, location: 'exchange_trade_panel' })

  const budget = u.krw * (pct / 100)
  const amount = budget / (price * (1 + FEE_RATE))
  const notional = price * amount
  const fee = notional * FEE_RATE

  if (outcome === 'fail' || notional < 5000 || budget <= 0) {
    emit(s, 'Order Submit Failed', { symbol: c.s, side: 'buy', order_type: orderType, failure_reason: '주문 가능 원화가 부족합니다.', location: 'exchange_trade_panel' })
    return
  }
  emit(s, 'Order Placed', {
    symbol: c.s, coin_name: c.n, side: 'buy', order_type: orderType,
    price, amount: +amount.toFixed(8), notional_krw: round(notional), fee_krw: round(fee), location: 'exchange_trade_panel',
  })
  if (orderType === 'limit' && outcome === 'cancel') {
    if (chance(0.5)) {
      emit(s, 'Nav Item Clicked', { destination: '거래내역', location: 'global_header' })
      pageView(s, '/orders')
      emit(s, 'Orders Filter Changed', { filter: 'open', location: 'orders' })
    }
    emit(s, 'Order Canceled', { order_id: `ord_${SEQ}`, symbol: c.s, side: 'buy', order_type: orderType, location: chance(0.5) ? 'orders' : 'exchange' })
    return
  }
  // 체결
  const latency = orderType === 'market' ? ri(1200, 1800) : ri(1500, 90_000)
  s.t += latency
  buildEvent(s.u, 'Order Filled', s.t, {
    symbol: c.s, coin_name: c.n, side: 'buy', order_type: orderType,
    fill_price: price, amount: +amount.toFixed(8), notional_krw: round(notional), fee_krw: round(fee), latency_ms: latency, location: 'fill_engine',
  }, s.sid)
  u.krw -= notional + fee
  u.holdings[c.s] = (u.holdings[c.s] || 0) + amount
  u.volume += notional
  u.tier = tierFor(u.volume)
}

function doSell(s, outcome) {
  const u = s.u
  const held = Object.keys(u.holdings).filter((k) => u.holdings[k] > 0)
  if (held.length === 0) {
    const c = coinPick()
    emit(s, 'Coin Selected', { symbol: c.s, coin_name: c.n, location: 'exchange_sidebar' })
    pageView(s, `/trade/${c.s}`)
    emit(s, 'Order Side Changed', { symbol: c.s, side: 'sell', location: 'exchange_trade_panel' })
    emit(s, 'Order Submit Failed', { symbol: c.s, side: 'sell', order_type: 'limit', failure_reason: '매도 가능 수량이 부족합니다.', location: 'exchange_trade_panel' })
    return
  }
  const sym = pick(held)
  const c = COINS.find((x) => x.s === sym)
  const orderType = chance(0.5) ? 'market' : 'limit'
  emit(s, 'Coin Selected', { symbol: sym, coin_name: c.n, location: chance(0.5) ? 'portfolio_holdings' : 'exchange_sidebar' })
  pageView(s, `/trade/${sym}`)
  emit(s, 'Order Side Changed', { symbol: sym, side: 'sell', location: 'exchange_trade_panel' })
  emit(s, 'Order Type Changed', { symbol: sym, order_type: orderType, location: 'exchange_trade_panel' })
  const pct = pick([25, 50, 100])
  emit(s, 'Order Ratio Clicked', { symbol: sym, side: 'sell', percent: pct, order_type: orderType, location: 'exchange_trade_panel' })
  const price = round(c.p * (1 + (rnd() - 0.5) * 0.012))
  const amount = u.holdings[sym] * (pct / 100)
  const notional = price * amount
  const fee = notional * FEE_RATE
  emit(s, 'Order Placed', { symbol: sym, coin_name: c.n, side: 'sell', order_type: orderType, price, amount: +amount.toFixed(8), notional_krw: round(notional), fee_krw: round(fee), location: 'exchange_trade_panel' })
  if (orderType === 'limit' && outcome === 'cancel') {
    emit(s, 'Order Canceled', { order_id: `ord_${SEQ}`, symbol: sym, side: 'sell', order_type: orderType, location: 'exchange' })
    return
  }
  const latency = orderType === 'market' ? ri(1200, 1800) : ri(1500, 60_000)
  s.t += latency
  buildEvent(s.u, 'Order Filled', s.t, { symbol: sym, coin_name: c.n, side: 'sell', order_type: orderType, fill_price: price, amount: +amount.toFixed(8), notional_krw: round(notional), fee_krw: round(fee), latency_ms: latency, location: 'fill_engine' }, s.sid)
  u.holdings[sym] -= amount
  u.krw += notional - fee
  u.volume += notional
  u.tier = tierFor(u.volume)
}

function doWatchlist(s) {
  const n = ri(1, 3)
  for (let i = 0; i < n; i++) {
    const c = coinPick()
    emit(s, 'Favorite Toggled', { symbol: c.s, coin_name: c.n, favorited: true, location: 'market_list' })
  }
}

function endSession(s, kind) {
  if (kind === 'timeout') emit(s, 'Session Timeout', { idle_minutes: 30, user_tier: s.u.tier }, [1800, 1800])
  else if (kind === 'logout') emit(s, 'Logout', { reason: 'manual', location: 'global_header' })
}

// ---------- 시나리오(세션) 조립 ----------
// 각 세션은 페르소나 상태에 맞춰 긍정/부정 분기로 흐른다.
function runSession(u, startMs, kind) {
  const s = session(u, startMs)
  const V = u.variants
  // 실험 lift: treatment 가 살짝 더 잘 전환
  const signupOk = 0.62 + (V['welcome-bonus'] === 'treatment' ? 0.1 : 0) + (V['market-hero'] === 'treatment' ? 0.04 : 0)
  const buyOk = 0.72 + (V['buy-cta'] === 'treatment' ? 0.09 : 0)

  if (kind === 'anon_browse') {
    doAnonBrowse(s)
    if (u.wantsTrade && chance(0.5)) {
      const c = coinPick()
      emit(s, 'Coin Selected', { symbol: c.s, coin_name: c.n, location: 'market_list' })
      pageView(s, `/trade/${c.s}`)
      exposure(s, 'buy-cta')
      emit(s, 'Trade Login Prompted', { symbol: c.s, side: 'buy', order_type: 'limit', location: 'exchange_trade_panel' })
    }
    if (chance(0.5)) endSession(s, chance(0.2) ? 'timeout' : null)
    return
  }

  if (kind === 'signup') {
    doAnonBrowse(s)
    const ok = doSignup(s, chance(signupOk))
    if (ok) {
      if (chance(0.7)) doDeposit(s)
      if (u.krw > 100_000 && chance(0.75)) doBuy(s, chance(0.5) ? 'market' : 'limit', chance(buyOk) ? 'fill' : 'fail')
      if (chance(0.4)) doWatchlist(s)
      endSession(s, chance(0.5) ? 'logout' : null)
    }
    return
  }

  if (kind === 'login_trade') {
    const ok = doLogin(s, chance(0.88))
    if (!ok) {
      endSession(s, null)
      return
    }
    // 로그인 후 자연스러운 활동
    const acts = ri(1, 4)
    for (let i = 0; i < acts; i++) {
      const roll = rnd()
      if (roll < 0.5) doBuy(s, chance(0.55) ? 'limit' : 'market', chance(buyOk) ? (chance(0.75) ? 'fill' : 'cancel') : 'fail')
      else if (roll < 0.7) doSell(s, chance(0.8) ? 'fill' : 'cancel')
      else if (roll < 0.82) doDeposit(s)
      else if (roll < 0.9) doWithdraw(s, chance(0.6))
      else {
        emit(s, 'Nav Item Clicked', { destination: '거래내역', location: 'global_header' })
        pageView(s, '/orders')
        emit(s, 'Orders Filter Changed', { filter: pick(['all', 'open', 'filled', 'canceled']), location: 'orders' })
      }
    }
    if (chance(0.15)) {
      pageView(s, '/portfolio')
      if (Object.keys(u.holdings).length === 0) emit(s, 'Empty State CTA Clicked', { destination: 'market', location: 'portfolio' })
      if (chance(0.1)) emit(s, 'Account Reset', { location: 'portfolio', user_tier: u.tier })
    }
    endSession(s, chance(0.12) ? 'timeout' : chance(0.5) ? 'logout' : null)
    return
  }

  if (kind === 'whale_trade') {
    doLogin(s, true)
    const acts = ri(4, 10)
    for (let i = 0; i < acts; i++) {
      if (chance(0.7)) doBuy(s, chance(0.5) ? 'market' : 'limit', chance(0.85) ? 'fill' : 'cancel')
      else doSell(s, chance(0.85) ? 'fill' : 'cancel')
    }
    endSession(s, chance(0.4) ? 'logout' : null)
    return
  }
}

// ---------- 페르소나별 유저 & 세션 타임라인 ----------
const PERSONAS = [
  { key: 'browser_no_signup', w: 22, sessions: [1, 3], krw: 0 },
  { key: 'signup_churn', w: 15, sessions: [1, 2], krw: 0 },
  { key: 'casual_trader', w: 30, sessions: [3, 8], krw: 0 },
  { key: 'active_trader', w: 18, sessions: [8, 18], krw: 0 },
  { key: 'whale', w: 6, sessions: [6, 16], krw: 20_000_000 },
  { key: 'returning_login', w: 9, sessions: [4, 12], krw: 5_000_000 },
]
function pickPersona() {
  const total = PERSONAS.reduce((a, p) => a + p.w, 0)
  let r = rnd() * total
  for (const p of PERSONAS) {
    r -= p.w
    if (r <= 0) return p
  }
  return PERSONAS[0]
}

function makeUser(idx) {
  const persona = pickPersona()
  const variants = {}
  for (const f of Object.keys(FLAGS)) variants[f] = pick(FLAGS[f])
  const nick = pick(['코린이', '존버마스터', '고래투자자', '단타왕', '가치투자', '무지성풀매수', '차트박사', '존버청년', '떡상기원', '비트러버']) + ri(1, 999)
  return {
    idx,
    persona: persona.key,
    deviceId: `seed-dev-${idx.toString().padStart(5, '0')}`,
    userId: null,
    nickname: nick,
    tier: 'WHITE',
    source: 'test_account',
    krw: persona.krw,
    holdings: {},
    volume: 0,
    wantsTrade: chance(0.5),
    variants,
    dev: pick(DEVICES),
    geo: pick(CITIES),
  }
}

function buildUserTimeline(u) {
  const persona = PERSONAS.find((p) => p.key === u.persona)
  const nSessions = ri(persona.sessions[0], persona.sessions[1])
  // 가입/최초 접속일: 기간 내 무작위 (뒤로 갈수록 신규 ↑ 가중)
  const joinBias = Math.pow(rnd(), 0.8)
  let cursor = START + joinBias * (END - START) * 0.85

  // returning_login / whale 은 기존 유저로 취급(가입 이벤트 없음, userId 존재)
  const existing = u.persona === 'returning_login' || u.persona === 'whale'
  if (existing) {
    u.userId = `seed_user_${u.idx.toString().padStart(5, '0')}`
    u.source = 'test_account'
    u.tier = tierFor(u.volume)
  }

  for (let i = 0; i < nSessions; i++) {
    if (cursor > END) break
    const t = timeOfDay(dayStart(cursor))
    let kind
    if (i === 0 && !existing) {
      kind = u.persona === 'browser_no_signup' ? 'anon_browse' : 'signup'
    } else if (u.persona === 'browser_no_signup') {
      kind = 'anon_browse'
    } else if (u.persona === 'whale') {
      kind = 'whale_trade'
    } else if (!u.userId) {
      kind = 'signup'
    } else {
      kind = 'login_trade'
    }
    runSession(u, t, kind)
    // 다음 세션까지 간격: 페르소나별
    const gapDays =
      u.persona === 'active_trader' || u.persona === 'whale'
        ? 0.3 + rnd() * 3
        : u.persona === 'casual_trader'
          ? 1 + rnd() * 9
          : 2 + rnd() * 20
    cursor += gapDays * DAY
  }
}

// ---------- 전송 ----------
async function sendChunk(events, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, events }),
  })
  if (res.status === 200) return { ok: true }
  const body = await res.text().catch(() => '')
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = 1000 * Math.pow(2, attempt)
    console.warn(`  ↻ ${res.status} 재시도 ${attempt + 1}/5 (${wait}ms)`) // eslint-disable-line
    await new Promise((r) => setTimeout(r, wait))
    return sendChunk(events, attempt + 1)
  }
  return { ok: false, status: res.status, body }
}

async function main() {
  console.log(`\n🌱 시드 생성: users=${N_USERS} dry-run=${DRY_RUN} max=${MAX_EVENTS === Infinity ? '∞' : MAX_EVENTS}`)
  for (let i = 0; i < N_USERS; i++) buildUserTimeline(makeUser(i))

  // 시간순 정렬(자연스러운 업로드 순서)
  ALL_EVENTS.sort((a, b) => a.time - b.time)
  let events = ALL_EVENTS
  if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS)

  // 통계
  const counts = {}
  for (const e of events) counts[e.event_type] = (counts[e.event_type] || 0) + 1
  const users = new Set(events.map((e) => e.user_id).filter(Boolean)).size
  const devices = new Set(events.map((e) => e.device_id)).size
  console.log(`\n📊 총 ${events.length.toLocaleString()} 이벤트 · user_id ${users} · device ${devices}`)
  console.log(`   기간 ${new Date(events[0].time).toISOString().slice(0, 10)} ~ ${new Date(events[events.length - 1].time).toISOString().slice(0, 10)}`)
  console.log('   이벤트별 건수:')
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`     ${v.toString().padStart(6)}  ${k}`))

  if (args.dump) {
    fs.writeFileSync(args.dump, JSON.stringify(events, null, 0))
    console.log(`   덤프 저장: ${args.dump}`)
  }
  if (DRY_RUN) {
    console.log('\n🔎 dry-run 샘플(첫 8개):')
    console.log(JSON.stringify(events.slice(0, 8), null, 2))
    return
  }

  console.log(`\n🚀 전송 시작 (chunk=${CHUNK})...`)
  let sent = 0
  let failed = 0
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK)
    const r = await sendChunk(chunk)
    if (r.ok) sent += chunk.length
    else {
      failed += chunk.length
      console.error(`  ✗ chunk @${i} 실패: ${r.status} ${String(r.body).slice(0, 200)}`) // eslint-disable-line
    }
    if ((i / CHUNK) % 10 === 0) process.stdout.write(`\r  진행 ${Math.min(i + CHUNK, events.length)}/${events.length}`)
    await new Promise((r) => setTimeout(r, 80))
  }
  console.log(`\n\n✅ 완료 — 전송 ${sent.toLocaleString()} · 실패 ${failed.toLocaleString()}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
