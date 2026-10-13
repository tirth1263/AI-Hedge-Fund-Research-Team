import React, { useState } from 'react'
import { BaseHandle, Position, type NoopNodeProps } from 'motia/workbench'

const EXAMPLES = ['AAPL stock analysis', 'NVDA outlook', 'Tesla (TSLA) risk']

/** Finance Query Starter: kicks off the workflow through POST /finance-query. */
export const Node: React.FC<NoopNodeProps> = ({ data }) => {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const start = async () => {
    if (!query.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/finance-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setTraceId(json.traceId)
      setStatus('Analysis started - watch the Tracing tab')
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.badge}>NOOP</span>
        <strong>Finance Query Starter</strong>
      </div>
      <p style={styles.muted}>{data.description}</p>
      <input
        style={styles.input}
        placeholder="e.g. AAPL, Tesla (TSLA), Microsoft"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && start()}
      />
      <div style={styles.chips}>
        {EXAMPLES.map((ex) => (
          <button key={ex} style={styles.chip} onClick={() => setQuery(ex)}>
            {ex}
          </button>
        ))}
      </div>
      <button style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading} onClick={start}>
        {loading ? 'Starting…' : 'Start Analysis'}
      </button>
      {status && <p style={styles.status}>{status}</p>}
      {traceId && (
        <a style={styles.link} href={`/finance-result/${traceId}`} target="_blank" rel="noreferrer">
          traceId: {traceId} ↗
        </a>
      )}
      <BaseHandle type="source" position={Position.Right} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: 280,
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
  input: { padding: '8px 10px', borderRadius: 8, border: '1px solid #475569', background: '#020617', color: '#f8fafc' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  chip: { fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' },
  button: { padding: '8px 10px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' },
  status: { margin: 0, color: '#a5b4fc' },
  link: { color: '#38bdf8', wordBreak: 'break-all' },
}
