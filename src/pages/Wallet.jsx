import { useState } from 'react'
import { useMarket } from '../context/MarketContext.jsx'
import { formatKRW } from '../lib/format.js'
import { track } from '../lib/amplitude.js'

const QUICK = [100_000, 500_000, 1_000_000, 5_000_000]

export default function Wallet() {
  const { portfolio, deposit, withdraw } = useMarket()
  const [mode, setMode] = useState('deposit') // deposit | withdraw
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState(null)

  if (!portfolio) return null
  const available = portfolio.krw - portfolio.krwInOrder

  function changeMode(next) {
    setMode(next)
    track('Wallet Mode Changed', { mode: next, location: 'wallet' })
  }

  function submit(e) {
    e.preventDefault()
    const value = Number(amount)
    const res = mode === 'deposit' ? deposit(value) : withdraw(value)
    if (res.ok) {
      setToast({ type: 'ok', msg: `${mode === 'deposit' ? '입금' : '출금'} 완료 · ${formatKRW(value)}` })
      setAmount('')
    } else {
      setToast({ type: 'err', msg: res.error })
    }
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>입출금</h1>
      </div>

      <div className="wallet-grid">
        <div className="wallet-balance">
          <span className="wb-label">보유 KRW</span>
          <strong className="wb-value">{formatKRW(portfolio.krw)}</strong>
          <div className="wb-row">
            <span>주문가능</span>
            <span>{formatKRW(available)}</span>
          </div>
          <div className="wb-row">
            <span>주문중 금액</span>
            <span>{formatKRW(portfolio.krwInOrder)}</span>
          </div>
          <p className="wb-note">
            ⓘ 실제 이체가 아닌 목업입니다. 원화 입출금은 즉시 잔고에 반영됩니다.
          </p>
        </div>

        <div className="wallet-form-card">
          <div className="mode-tabs">
            <button
              className={mode === 'deposit' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => changeMode('deposit')}
            >
              원화 입금
            </button>
            <button
              className={mode === 'withdraw' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => changeMode('withdraw')}
            >
              원화 출금
            </button>
          </div>

          <form onSubmit={submit} className="wallet-form">
            <label className="field">
              <span>{mode === 'deposit' ? '입금' : '출금'} 금액 (KRW)</span>
              <input
                type="number"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className="quick-row">
              {QUICK.map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => {
                    setAmount(String((Number(amount) || 0) + q))
                    track('Wallet Quick Amount Clicked', { amount: q, mode, location: 'wallet' })
                  }}
                >
                  +{formatKRW(q, { withUnit: false })}
                </button>
              ))}
              <button type="button" className="clear" onClick={() => setAmount('')}>
                초기화
              </button>
            </div>
            <button type="submit" className={`btn-primary lg ${mode === 'withdraw' ? 'sell' : ''}`}>
              {mode === 'deposit' ? '입금하기' : '출금하기'}
            </button>
          </form>
          {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
      </div>
    </div>
  )
}
