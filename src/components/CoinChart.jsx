import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarket } from '../context/MarketContext.jsx'
import { COIN_MAP, createCandles } from '../lib/market.js'
import { formatPrice, formatTime } from '../lib/format.js'

const CANDLE_MS = 60_000 // 1분봉

/**
 * 직접 그리는 SVG 캔들스틱 차트.
 * 초기 히스토리를 생성한 뒤, 실시간 시세로 마지막 캔들을 갱신하고
 * 1분이 지나면 새 캔들을 시작합니다.
 */
export default function CoinChart({ symbol }) {
  const { tickers } = useMarket()
  const coin = COIN_MAP[symbol]
  const price = tickers[symbol]?.price
  const [candles, setCandles] = useState(() => createCandles(coin, 60))
  const [hover, setHover] = useState(null)

  // 심볼 변경 시 히스토리 재생성
  useEffect(() => {
    setCandles(createCandles(coin, 60))
  }, [symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // 실시간 가격으로 마지막 캔들 갱신
  useEffect(() => {
    if (price == null) return
    setCandles((prev) => {
      const arr = [...prev]
      const lastCandle = arr[arr.length - 1]
      const now = Date.now()
      if (now - lastCandle.time >= CANDLE_MS) {
        arr.push({ time: now, open: price, high: price, low: price, close: price, volume: 0 })
        if (arr.length > 80) arr.shift()
      } else {
        arr[arr.length - 1] = {
          ...lastCandle,
          close: price,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
        }
      }
      return arr
    })
  }, [price])

  const W = 640
  const H = 300
  const padR = 64
  const padB = 22
  const plotW = W - padR
  const plotH = H - padB

  const geom = useMemo(() => {
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)
    const max = Math.max(...highs)
    const min = Math.min(...lows)
    const range = max - min || 1
    const pad = range * 0.08
    const yMax = max + pad
    const yMin = min - pad
    const yRange = yMax - yMin
    const cw = plotW / candles.length
    const y = (v) => plotH - ((v - yMin) / yRange) * plotH
    return { yMax, yMin, yRange, cw, y }
  }, [candles, plotW, plotH])

  const gridLines = 4
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        {/* 가로 그리드 + 가격 라벨 */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const v = geom.yMax - (geom.yRange / gridLines) * i
          const yy = geom.y(v)
          return (
            <g key={i}>
              <line x1="0" y1={yy} x2={plotW} y2={yy} className="grid" />
              <text x={W - padR + 6} y={yy + 3} className="axis-label">
                {formatPrice(v)}
              </text>
            </g>
          )
        })}

        {/* 캔들 */}
        {candles.map((c, i) => {
          const up = c.close >= c.open
          const x = i * geom.cw + geom.cw / 2
          const bodyTop = geom.y(Math.max(c.open, c.close))
          const bodyBottom = geom.y(Math.min(c.open, c.close))
          const bodyH = Math.max(bodyBottom - bodyTop, 1)
          const bw = Math.max(geom.cw * 0.6, 1.5)
          const cls = up ? 'candle-up' : 'candle-down'
          return (
            <g key={c.time} className={cls}
              onMouseEnter={() => setHover({ c, x })}
            >
              <line x1={x} y1={geom.y(c.high)} x2={x} y2={geom.y(c.low)} className="wick" />
              <rect x={x - bw / 2} y={bodyTop} width={bw} height={bodyH} className="body" />
            </g>
          )
        })}

        {/* 현재가 점선 */}
        {price != null && (
          <g>
            <line x1="0" y1={geom.y(price)} x2={plotW} y2={geom.y(price)} className="price-line" />
            <rect x={W - padR} y={geom.y(price) - 9} width={padR} height={18} className="price-tag" />
            <text x={W - padR + 6} y={geom.y(price) + 3} className="price-tag-text">
              {formatPrice(price)}
            </text>
          </g>
        )}
      </svg>

      {hover && (
        <div className="chart-tooltip">
          <span>{formatTime(hover.c.time)}</span>
          <span>시 {formatPrice(hover.c.open)}</span>
          <span>고 {formatPrice(hover.c.high)}</span>
          <span>저 {formatPrice(hover.c.low)}</span>
          <span>종 {formatPrice(hover.c.close)}</span>
        </div>
      )}
    </div>
  )
}
