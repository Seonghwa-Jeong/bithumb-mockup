import { useEffect, useRef, useState } from 'react'
import { useMarket } from '../context/MarketContext.jsx'

const MAX_POINTS = 30

/** 최근 시세를 누적해 그리는 초소형 라인 차트 */
export default function Sparkline({ symbol, up }) {
  const { tickers } = useMarket()
  const price = tickers[symbol]?.price
  const [points, setPoints] = useState([])
  const last = useRef(null)

  useEffect(() => {
    if (price == null || price === last.current) return
    last.current = price
    setPoints((p) => [...p, price].slice(-MAX_POINTS))
  }, [price])

  if (points.length < 2) return <div className="spark-empty" />

  const w = 80
  const h = 28
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const d = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ')

  const color = up ? '#c84a31' : '#1261c4'
  return (
    <svg width={w} height={h} className="sparkline">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}
