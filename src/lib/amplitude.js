/**
 * Amplitude Analytics + Experiment 연동 래퍼
 * -------------------------------------------------
 * 이 파일 하나만 보면 "어디서 어떤 이벤트가 나가는지" 파악할 수 있도록
 * 모든 트래킹을 track() / identifyUser() / getVariant() 로 감쌌습니다.
 *
 * ── 이벤트 네이밍 규칙 ──────────────────────────────────────────
 *  · 페이지 고유 동작은 페이지명을 접두어로 붙입니다.
 *      예) "Market Sorted", "Orders Filter Changed", "Wallet Deposit Completed"
 *  · 여러 화면에서 공통으로 일어나는 퍼널성 동작은 이벤트명을 통일하고
 *    `location` 속성으로 발생 위치를 구분합니다.
 *      예) "Coin Selected" { location: 'market_list' | 'exchange_sidebar' | 'portfolio' }
 *  · 모든 상호작용 이벤트는 발생 위치를 알 수 있게 `location` 을 포함합니다.
 *  · 페이지 조회(Page Viewed)는 SDK 오토캡쳐가 담당하므로 수동 태깅하지 않습니다.
 * ──────────────────────────────────────────────────────────────
 */
import * as amplitude from '@amplitude/analytics-browser'
import { Experiment } from '@amplitude/experiment-js-client'

// ---- 키 설정 ------------------------------------------------
// 키는 .env.local 에 두고(빌드시 클라이언트 번들에 주입) 여기서는 참조만 합니다.
//   VITE_AMPLITUDE_API_KEY           = Analytics API Key
//   VITE_EXPERIMENT_DEPLOYMENT_KEY   = Experiment "Web"(client-side) Deployment Key
export const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY || 'YOUR_AMPLITUDE_API_KEY'
export const EXPERIMENT_DEPLOYMENT_KEY =
  import.meta.env.VITE_EXPERIMENT_DEPLOYMENT_KEY || 'YOUR_WEB_DEPLOYMENT_KEY'
// -------------------------------------------------------------

const isPlaceholder = (k) => !k || k.startsWith('YOUR_')

let experimentClient = null
let analyticsReady = false

export function initAmplitude() {
  if (isPlaceholder(AMPLITUDE_API_KEY)) {
    // 키가 없으면 콘솔에 이벤트를 찍어 흐름을 확인할 수 있게 함 (데모 편의)
    console.info(
      '%c[Amplitude] 플레이스홀더 키 사용 중 — 이벤트는 콘솔에만 출력됩니다.\n' +
        'src/lib/amplitude.js 의 AMPLITUDE_API_KEY / EXPERIMENT_DEPLOYMENT_KEY 를 교체하세요.',
      'color:#f7a600;font-weight:bold',
    )
    return
  }

  amplitude.init(AMPLITUDE_API_KEY, {
    // 오토캡쳐: 페이지뷰 + Web Vitals 활성화, 그 외 SDK 기본 활성값(attribution·
    // fileDownloads·formInteractions·sessions)은 그대로 유지합니다.
    autocapture: {
      attribution: true, // 기본 활성 (마케팅 어트리뷰션)
      fileDownloads: true, // 기본 활성
      formInteractions: true, // 기본 활성
      pageViews: true, // 페이지뷰 오토캡쳐 (요청)
      sessions: true, // 기본 활성 (세션 트래킹)
      elementInteractions: true, // 요소 클릭 자동 캡쳐 (수동 태깅 보완)
      webVitals: true, // Web Vitals (요청)
    },
  })
  analyticsReady = true

  // Experiment SDK — Analytics 인스턴스와 연결해 identity/노출(exposure) 자동 연동
  if (!isPlaceholder(EXPERIMENT_DEPLOYMENT_KEY)) {
    experimentClient = Experiment.initializeWithAmplitudeAnalytics(EXPERIMENT_DEPLOYMENT_KEY)
    // 화면 첫 로딩 시 최초 평가
    fetchExperiment('app_load')
  }
}

/** 이벤트 트래킹 — 앱 전역에서 이 함수만 호출 */
export function track(eventName, eventProperties = {}) {
  if (analyticsReady) {
    amplitude.track(eventName, eventProperties)
  } else {
    console.log('[track]', eventName, eventProperties)
  }
}

/**
 * Experiment 재평가(fetch).
 * identity(user_id/device_id) 또는 사용자 속성이 바뀌는 모든 지점에서 호출합니다.
 * (앱 첫 로딩·로그인·로그아웃·회원가입·계좌 등록·세션 타임아웃 등)
 * Analytics 연동 클라이언트이므로 현재 Amplitude identity 를 자동으로 사용합니다.
 */
export function fetchExperiment(reason = 'manual') {
  if (!experimentClient) {
    console.log('[experiment] fetch skipped (no client) — reason:', reason)
    return
  }
  experimentClient
    .fetch()
    .catch((e) => console.warn('[Experiment] fetch 실패', 'reason:', reason, e))
}

/** 로그인/회원가입 시 유저 식별 + Experiment 재평가 */
export function identifyUser(userId, userProps = {}) {
  if (analyticsReady) {
    amplitude.setUserId(userId)
    const identify = new amplitude.Identify()
    Object.entries(userProps).forEach(([k, v]) => identify.set(k, v))
    amplitude.identify(identify)
  } else {
    console.log('[identify]', userId, userProps)
  }
  // 유저 컨텍스트 변경 → Experiment 재평가
  fetchExperiment('identify')
}

/** 로그아웃/세션종료 시 identity 초기화 + Experiment 재평가(익명 컨텍스트) */
export function resetUser() {
  if (analyticsReady) {
    amplitude.reset()
  }
  // 익명 상태로 되돌아갔으니 다시 평가
  fetchExperiment('reset')
}

/**
 * Experiment 변형(variant) 조회.
 * 키가 없거나 실험이 없으면 fallback 을 반환 → 목업이 항상 동작.
 */
export function getVariant(flagKey, fallback = 'control') {
  if (experimentClient) {
    const v = experimentClient.variant(flagKey, fallback)
    return v?.value || fallback
  }
  // 데모 모드: localStorage 로 변형을 고정해 A/B 를 눈으로 확인 가능
  const forced = localStorage.getItem(`exp_force_${flagKey}`)
  return forced || fallback
}

/** 데모용: 특정 플래그 변형을 강제 지정 (개발자 콘솔에서 호출 가능) */
export function forceVariant(flagKey, value) {
  localStorage.setItem(`exp_force_${flagKey}`, value)
}

// 콘솔에서 손쉽게 A/B 를 토글할 수 있도록 전역 노출 (데모 편의)
if (typeof window !== 'undefined') {
  window.__bithumbExp = { getVariant, forceVariant, fetchExperiment }
}
