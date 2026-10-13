import { useEffect, useRef, useState } from 'react'
import type { LogEntry, StepId, StepTrace } from '../engine/workflow'
import { duration } from '../lib/format'

/** Gantt style timeline, like the Motia Workbench "Tracing" tab. */
export function TraceTimeline({ traces, order }: { traces: Partial<Record<StepId, StepTrace>>; order: StepId[] }) {
  const [now, setNow] = useState(Date.now())
  const rows = order.map((id) => traces[id]).filter((t): t is StepTrace => Boolean(t?.start))
  const running = rows.some((r) => r.state === 'running')

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [running])

  if (!rows.length) return <div className="empty">Run an analysis to see the execution trace.</div>

  const t0 = Math.min(...rows.map((r) => r.start!))
  const t1 = Math.max(...rows.map((r) => r.end ?? now), t0 + 1)
  const span = t1 - t0

  return (
    <div>
      {rows.map((r) => {
        const end = r.end ?? now
        const left = ((r.start! - t0) / span) * 100
        const width = Math.max(((end - r.start!) / span) * 100, 0.4)
        return (
          <div className="trace-row" key={r.id}>
            <div className="name" title={r.id}>
              {r.id}
            </div>
            <div className="track">
              <div className={`bar ${r.state}`} style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
            <div className="dur">{duration(end - r.start!)}</div>
          </div>
        )
      })}
    </div>
  )
}

export function LogsPanel({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [logs.length])

  if (!logs.length) return <div className="empty">Structured logs from every agent appear here.</div>
  return (
    <div className="logs" ref={ref}>
      {logs.map((l, i) => (
        <div className="log" key={i}>
          <span className="ts">{new Date(l.time).toLocaleTimeString([], { hour12: false })}</span>
          <span className={`lvl ${l.level}`}>{l.level === 'info' ? '●' : l.level === 'warn' ? '▲' : '✖'}</span>
          <span>
            <span className="step">[{l.step}]</span> {l.message}
          </span>
        </div>
      ))}
    </div>
  )
}
