import { useState } from 'react'
import {
  KNOWN_FLAGS,
  getVariant,
  getPayload,
  forceVariant,
  forcePayload,
  clearOverride,
  hasOverride,
  getDeviceId,
  getUserId,
  setDeviceId,
  fetchExperiment,
} from '../lib/amplitude.js'

// 실험 디버그 패널 — device id 변경 / 적용된 실험·값 확인 / 강제 override / 재평가
export default function DevTools() {
  const [open, setOpen] = useState(() => localStorage.getItem('devtools_open') === '1')
  const [device, setDevice] = useState(() => getDeviceId() || '')
  const [drafts, setDrafts] = useState({}) // flagKey -> 편집중 문자열
  const [busy, setBusy] = useState(false)

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('devtools_open', next ? '1' : '0')
  }

  function currentValue(f) {
    return f.type === 'variant' ? getVariant(f.key, 'control') : getPayload(f.key, {})
  }

  function draftFor(f) {
    if (drafts[f.key] != null) return drafts[f.key]
    const v = currentValue(f)
    return f.type === 'variant' ? v : JSON.stringify(v)
  }

  function setDraft(key, val) {
    setDrafts((d) => ({ ...d, [key]: val }))
  }

  function apply(f) {
    const raw = draftFor(f)
    if (f.type === 'variant') {
      forceVariant(f.key, raw.trim())
    } else {
      try {
        forcePayload(f.key, JSON.parse(raw))
      } catch {
        alert(`payload JSON 파싱 실패: ${f.key}`)
        return
      }
    }
    location.reload()
  }

  function reset(f) {
    clearOverride(f.key)
    location.reload()
  }

  async function applyDevice() {
    setBusy(true)
    await setDeviceId(device.trim() || cryptoRandom())
    location.reload()
  }

  function randomDevice() {
    setDevice(cryptoRandom())
  }

  async function refetch() {
    setBusy(true)
    await fetchExperiment('devtools_manual')
    location.reload()
  }

  if (!open) {
    return (
      <button className="devtools-fab" onClick={toggle} title="실험 도구 열기">
        🧪
      </button>
    )
  }

  return (
    <div className="devtools">
      <div className="devtools-head">
        <strong>🧪 실험 도구</strong>
        <button className="devtools-x" onClick={toggle} aria-label="닫기">
          ×
        </button>
      </div>

      <div className="devtools-body">
        <section>
          <h4>Identity</h4>
          <div className="dt-row">
            <span className="dt-label">User ID</span>
            <code className="dt-code">{getUserId() || '(비로그인)'}</code>
          </div>
          <label className="dt-label" htmlFor="dt-device">
            Device ID
          </label>
          <input
            id="dt-device"
            className="dt-input"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            spellCheck={false}
          />
          <div className="dt-btns">
            <button className="btn-mini" onClick={randomDevice}>
              랜덤 생성
            </button>
            <button className="btn-mini" onClick={applyDevice} disabled={busy}>
              적용 + 재평가
            </button>
          </div>
          <p className="dt-hint">device id 를 바꾸면 실험 재배정을 테스트할 수 있습니다.</p>
        </section>

        <section>
          <h4>실험 / Remote Config</h4>
          {KNOWN_FLAGS.map((f) => (
            <div key={f.key} className="dt-flag">
              <div className="dt-flag-head">
                <span className="dt-flag-name">
                  {f.label} <em>{f.key}</em>
                </span>
                {hasOverride(f.key) && <span className="dt-badge">override</span>}
              </div>
              {f.type === 'variant' ? (
                <input
                  className="dt-input"
                  value={draftFor(f)}
                  onChange={(e) => setDraft(f.key, e.target.value)}
                  placeholder="control / treatment"
                  spellCheck={false}
                />
              ) : (
                <textarea
                  className="dt-input dt-json"
                  rows={2}
                  value={draftFor(f)}
                  onChange={(e) => setDraft(f.key, e.target.value)}
                  spellCheck={false}
                />
              )}
              <div className="dt-btns">
                <button className="btn-mini" onClick={() => apply(f)}>
                  적용
                </button>
                <button className="btn-mini" onClick={() => reset(f)}>
                  초기화
                </button>
              </div>
            </div>
          ))}
        </section>

        <button className="btn-ghost dt-refetch" onClick={refetch} disabled={busy}>
          Experiment 재평가(fetch) + 새로고침
        </button>
      </div>
    </div>
  )
}

function cryptoRandom() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
