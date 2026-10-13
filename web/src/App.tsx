import { useCallback, useRef, useState } from 'react'
import type { FinanceResult } from '@services/types'
import { HowItWorks } from './components/HowItWorks'
import { ReportView } from './components/ReportView'
import { SettingsModal } from './components/SettingsModal'
import { LogsPanel, TraceTimeline } from './components/TracePanel'
import { WorkflowGraph } from './components/WorkflowGraph'
import { runBrowserWorkflow, runServerWorkflow, type LogEntry, type StepId, type StepTrace } from './engine/workflow'
import { addToHistory, clearHistory, loadHistory } from './lib/history'
import { timeAgo } from './lib/format'
import { isReady, loadSettings, saveSettings, type Settings } from './lib/settings'

const REPO_URL = 'https://github.com/tirth1263/AI-Hedge-Fund-Research-Team'
const EXAMPLES = ['AAPL stock analysis', 'NVDA outlook', 'Is MSFT a buy?', 'Tesla (TSLA) risk', 'AMZN long-term investment']

const TRACE_ORDER: StepId[] = [
  'FinanceQueryAPI',
  'FinanceDataAgent',
  'WebSearchAgent',
  'ResponseCoordinator',
  'NebiusAIAnalysis',
  'TechnicalAnalyst',
  'RiskManager',
  'PortfolioManager',
  'FundamentalAnalyst',
  'ParallelAnalysisCoordinator',
  'SaveResult',
  'FinanceResultAPI',
]

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#lg)" />
      <path d="M7 21l5.5-6 4 3.5L25 10" stroke="#05101f" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="10" r="2.2" fill="#05101f" />
    </svg>
  )
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [traces, setTraces] = useState<Partial<Record<StepId, StepTrace>>>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<FinanceResult[]>(loadHistory)
  const resultRef = useRef<HTMLDivElement>(null)
  const ready = isReady(settings)

  const run = useCallback(
    async (q: string) => {
      const text = q.trim()
      if (text.length < 2 || running) return
      if (!ready) {
        setShowSettings(true)
        return
      }
      setRunning(true)
      setError(null)
      setResult(null)
      setTraces({})
      setLogs([])
      const callbacks = {
        onStep: (t: StepTrace) => setTraces((prev) => ({ ...prev, [t.id]: t })),
        onLog: (l: LogEntry) => setLogs((prev) => [...prev, l]),
      }
      try {
        const res =
          settings.mode === 'server' ? await runServerWorkflow(text, settings.serverUrl, callbacks) : await runBrowserWorkflow(text, settings, callbacks)
        setResult(res)
        setHistory(addToHistory(res))
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setRunning(false)
      }
    },
    [ready, running, settings],
  )

  const onSaveSettings = (s: Settings) => {
    saveSettings(s)
    setSettings(s)
    setShowSettings(false)
  }

  const hasActivity = running || logs.length > 0
  const totalMs = (() => {
    const all = Object.values(traces).filter(Boolean) as StepTrace[]
    if (!all.length) return null
    const start = Math.min(...all.map((t) => t.start ?? Date.now()))
    const end = Math.max(...all.map((t) => t.end ?? Date.now()))
    return end - start
  })()

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <Logo />
            <span className="brand-name">
              AI Hedge Fund
              <small>Research Team</small>
            </span>
          </a>
          <div className="nav-spacer" />
          <a className="nav-link hide-sm" href="#how">
            How it works
          </a>
          <a className="nav-link hide-sm" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button className="btn btn-sm" onClick={() => setShowSettings(true)}>
            <span className={`dot ${ready ? 'ok' : 'warn'}`} />
            {settings.mode === 'server' ? 'Server mode' : ready ? 'Keys set' : 'Add API keys'}
          </button>
        </div>
      </nav>

      <main id="top" className="container">
        <section className="hero">
          <span className="eyebrow">
            <span className="dot ok" /> Multi-agent workflow · Motia · Nebius AI Studio
          </span>
          <h1>
            Your on-demand <span className="gradient-text">AI hedge fund</span> research desk
          </h1>
          <p className="lead">
            Ask about any stock. A team of AI analysts gathers live market data and news, runs fundamental, technical, risk and portfolio analysis in parallel, and delivers an investment committee verdict in under a minute.
          </p>

          <form
            className="query-box"
            onSubmit={(e) => {
              e.preventDefault()
              run(query)
            }}
          >
            <input
              aria-label="Stock or company to analyze"
              placeholder="e.g. AAPL stock analysis, Is NVDA overvalued?"
              value={query}
              maxLength={300}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={running || query.trim().length < 2}>
              {running ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                'Run analysis →'
              )}
            </button>
          </form>
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="chip"
                disabled={running}
                onClick={() => {
                  setQuery(ex)
                  run(ex)
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          {!ready && (
            <div className="callout">
              <span>🔑 Add a free Nebius AI Studio key to run the agents. Alpha Vantage and Serper keys are optional and add live market data and news.</span>
              <button className="btn btn-sm" onClick={() => setShowSettings(true)}>
                Add keys
              </button>
            </div>
          )}
          {error && <div className="callout error">✖ {error}</div>}
        </section>

        {hasActivity && (
          <section className="section stack">
            <div className="panel">
              <div className="panel-head">
                <h3>🔄 aihedgefund-workflow</h3>
                <span className="meta">
                  {running ? 'running' : error ? 'failed' : 'completed'}
                  {totalMs !== null ? ` · ${(totalMs / 1000).toFixed(1)}s` : ''}
                </span>
              </div>
              <div className="panel-body">
                <WorkflowGraph traces={traces} />
                <div className="legend" style={{ marginTop: 10 }}>
                  <span>
                    <i style={{ background: '#60a5fa' }} /> running
                  </span>
                  <span>
                    <i style={{ background: '#34d399' }} /> completed
                  </span>
                  <span>
                    <i style={{ background: '#fbbf24' }} /> skipped (no key)
                  </span>
                  <span>
                    <i style={{ background: '#f87171' }} /> failed
                  </span>
                </div>
              </div>
            </div>
            <div className="grid-2">
              <div className="panel">
                <div className="panel-head">
                  <h3>⏱️ Tracing</h3>
                  <span className="meta">{result?.traceId ?? ''}</span>
                </div>
                <div className="panel-body">
                  <TraceTimeline traces={traces} order={TRACE_ORDER} />
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>📜 Logs</h3>
                  <span className="meta">{logs.length} entries</span>
                </div>
                <LogsPanel logs={logs} />
              </div>
            </div>
          </section>
        )}

        <div ref={resultRef} style={{ scrollMarginTop: 80 }}>
          {result?.comprehensiveReport && (
            <section className="section">
              <ReportView key={result.traceId} result={result} />
            </section>
          )}
        </div>

        {history.length > 0 && (
          <section className="section">
            <div className="row-gap" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>🗂️ Recent reports</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  clearHistory()
                  setHistory([])
                }}
              >
                Clear
              </button>
            </div>
            <div className="history">
              {history.map((h) => (
                <button
                  key={h.traceId}
                  onClick={() => {
                    setResult(h)
                    setError(null)
                    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                  }}
                >
                  {h.comprehensiveReport?.symbol ? <b>{h.comprehensiveReport.symbol}</b> : null} {h.query}
                  {h.comprehensiveReport?.executiveSummary && <span className="muted"> · {h.comprehensiveReport.executiveSummary.rating}</span>}
                  <small>
                    {h.traceId} · {timeAgo(h.createdAt)}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}

        <HowItWorks />
      </main>

      <footer>
        <div className="container row">
          <span>
            Built with <a href="https://motia.dev" target="_blank" rel="noreferrer">Motia</a> and{' '}
            <a href="https://nebius.com/ai-studio" target="_blank" rel="noreferrer">Nebius AI Studio</a> ·{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </span>
          <span>For research and education only. Not investment advice.</span>
        </div>
      </footer>

      {showSettings && <SettingsModal initial={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />}
    </>
  )
}
