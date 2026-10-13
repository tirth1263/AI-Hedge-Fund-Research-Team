import { useMemo, useState } from 'react'
import type { PricePoint } from '@services/types'

const W = 760
const H = 260
const PAD = { l: 52, r: 14, t: 14, b: 26 }

function movingAverage(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null
    const slice = values.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

/** Close price with SMA20 / SMA50 overlays and a hover crosshair. */
export function PriceChart({ history }: { history: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const model = useMemo(() => {
    const closes = history.map((p) => p.close)
    const sma20 = movingAverage(closes, 20)
    const sma50 = movingAverage(closes, 50)
    const all = [...closes, ...(sma20.filter(Boolean) as number[]), ...(sma50.filter(Boolean) as number[])]
    const min = Math.min(...all)
    const max = Math.max(...all)
    const pad = (max - min) * 0.08 || 1
    const lo = min - pad
    const hi = max + pad
    const x = (i: number) => PAD.l + (i / Math.max(history.length - 1, 1)) * (W - PAD.l - PAD.r)
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
    const line = (vals: (number | null)[]) =>
      vals
        .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
        .filter(Boolean)
        .map((p, i) => `${i ? 'L' : 'M'}${p}`)
        .join(' ')
    const closePath = line(closes)
    const area = `${closePath} L${x(closes.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`
    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
    const up = closes[closes.length - 1] >= closes[0]
    return { closes, x, y, closePath, area, sma20: line(sma20), sma50: line(sma50), ticks, up }
  }, [history])

  if (history.length < 2) return <div className="empty">No price history available.</div>

  const color = model.up ? '#22c55e' : '#ef4444'
  const point = hover !== null ? history[hover] : null

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (history.length - 1))
    setHover(Math.max(0, Math.min(history.length - 1, idx)))
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Price chart">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {model.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={model.y(t)} y2={model.y(t)} stroke="#1f2a44" strokeDasharray="3 4" />
            <text x={PAD.l - 8} y={model.y(t) + 4} textAnchor="end" fontSize="10.5" fill="#8b97b1" fontFamily="JetBrains Mono, monospace">
              {t.toFixed(t >= 100 ? 0 : 2)}
            </text>
          </g>
        ))}
        {[0, Math.floor(history.length / 2), history.length - 1].map((i) => (
          <text key={i} x={model.x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === history.length - 1 ? 'end' : 'middle'} fontSize="10.5" fill="#8b97b1">
            {history[i].date}
          </text>
        ))}
        <path d={model.area} fill="url(#area)" />
        <path d={model.sma50} fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="4 3" />
        <path d={model.sma20} fill="none" stroke="#fbbf24" strokeWidth="1.4" />
        <path d={model.closePath} fill="none" stroke={color} strokeWidth="2" />
        {point && hover !== null && (
          <g>
            <line x1={model.x(hover)} x2={model.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#5d6a86" />
            <circle cx={model.x(hover)} cy={model.y(point.close)} r="4" fill={color} stroke="#0f172a" strokeWidth="2" />
          </g>
        )}
      </svg>
      {point && hover !== null && (
        <div className="chart-tip" style={{ left: `${(model.x(hover) / W) * 100}%`, top: `${(model.y(point.close) / H) * 100}%` }}>
          {point.date} · {point.close.toFixed(2)}
        </div>
      )}
      <div className="legend" style={{ marginTop: 8 }}>
        <span>
          <i style={{ background: color }} /> Close
        </span>
        <span>
          <i style={{ background: '#fbbf24' }} /> SMA 20
        </span>
        <span>
          <i style={{ background: '#a78bfa' }} /> SMA 50
        </span>
      </div>
    </div>
  )
}
