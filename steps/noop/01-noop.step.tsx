import React, { useState } from 'react'
import { BaseHandle, Position, type NoopNodeProps } from 'motia/workbench'

type ResultResponse = {
  status: string
  error?: string
  progress?: Record<string, string>
  comprehensiveReport?: {
    summary: string
    executiveSummary?: { rating: string; confidence: number; thesis: string }
    completedAnalyses: string[]
  }
}

/** Result Viewer: fetches GET /finance-result/:traceId and shows a compact summary. */
export const Node: React.FC<NoopNodeProps> = ({ data }) => {
  const [traceId, setTraceId] = useState('')
  const [result, setResult] = useState<ResultResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const view = async () => {
    if (!traceId.trim()) return
    setError(null)
    try {
      const res = await fetch(`/finance-result/${traceId.trim()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setResult(json)
    } catch (err) {
      setResult(null)
      setError((err as Error).message)
    }
  }

  const report = result?.comprehensiveReport
  return (
    <div style={styles.card}>
      <BaseHandle type="target" position={Position.Left} />
      <div style={styles.header}>
        <span style={styles.badge}>NOOP</span>
        <strong>Result Viewer</strong>
      </div>
      <p style={styles.muted}>{data.description}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={styles.input}
          placeholder="Paste traceId"
          value={traceId}
          onChange={(e) => setTraceId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && view()}
        />
        <button style={styles.button} onClick={view}>
          View
        </button>
      </div>
      {error && <p style={{ ...styles.muted, color: '#f87171' }}>{error}</p>}
      {result && (
        <div style={styles.result}>
          <div>
            Status: <strong>{result.status}</strong>
          </div>
          {result.status === 'processing' && result.progress && (
            <div style={styles.muted}>
              {Object.entries(result.progress)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </div>
          )}
          {report?.executiveSummary && (
            <div>
              Rating: <strong>{report.executiveSummary.rating}</strong> ({report.executiveSummary.confidence}% confidence)
            </div>
          )}
          {report && <div style={styles.muted}>{report.executiveSummary?.thesis ?? report.summary}</div>}
          {result.error && <div style={{ color: '#f87171' }}>{result.error}</div>}
          <a style={styles.link} href={`/finance-result/${traceId.trim()}`} target="_blank" rel="noreferrer">
            Open full JSON report ↗
          </a>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: 300,
    padding: 16,
    borderRadius: 12,
    background: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #334155',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  badge: { background: '#7c3aed', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 },
  muted: { color: '#94a3b8', margin: 0 },
  input: { flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #475569', background: '#020617', color: '#f8fafc' },
  button: { padding: '8px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' },
  result: { display: 'flex', flexDirection: 'column', gap: 4, padding: 8, borderRadius: 8, background: '#020617' },
  link: { color: '#38bdf8' },
}
