import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AnalysisType, FinanceResult, Rating } from '@services/types'
import { formatLargeNumber, fractionPct, money, num, pct } from '../lib/format'
import { PriceChart } from './PriceChart'

const TAB_ORDER: { key: AnalysisType; label: string; icon: string }[] = [
  { key: 'general', label: 'Market Overview', icon: '🌐' },
  { key: 'fundamental', label: 'Fundamental', icon: '📊' },
  { key: 'technical', label: 'Technical', icon: '📈' },
  { key: 'risk', label: 'Risk', icon: '🛡️' },
  { key: 'portfolio', label: 'Portfolio', icon: '💼' },
]

const RATING_COLOR: Record<Rating, string> = {
  'Strong Buy': '#22c55e',
  Buy: '#34d399',
  Hold: '#fbbf24',
  Sell: '#f87171',
  'Strong Sell': '#ef4444',
}

export function ReportView({ result }: { result: FinanceResult }) {
  const report = result.comprehensiveReport!
  const firstAvailable = TAB_ORDER.find((t) => report.sections[t.key])?.key ?? 'general'
  const [tab, setTab] = useState<AnalysisType | 'sources' | 'json'>(firstAvailable)
  const { quote, overview, indicators, history } = report.marketData
  const exec = report.executiveSummary
  const section = tab !== 'sources' && tab !== 'json' ? report.sections[tab] : undefined

  const download = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-hedge-fund-${report.symbol ?? 'report'}-${result.traceId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpis: [string, string][] = [
    ['Market cap', overview?.marketCap ? `$${formatLargeNumber(overview.marketCap)}` : '—'],
    ['P/E (TTM)', num(overview?.peRatio)],
    ['Forward P/E', num(overview?.forwardPE)],
    ['EPS', num(overview?.eps)],
    ['Profit margin', fractionPct(overview?.profitMargin)],
    ['ROE', fractionPct(overview?.returnOnEquity)],
    ['Beta', num(overview?.beta)],
    ['Dividend yield', fractionPct(overview?.dividendYield, 2)],
    ['52w range', overview?.week52Low ? `${num(overview.week52Low, 0)} – ${num(overview.week52High, 0)}` : '—'],
    ['Analyst target', money(overview?.analystTargetPrice)],
    ['RSI (14)', num(indicators?.rsi14, 1)],
    ['Volatility (ann.)', pct(indicators?.annualizedVolatility)],
    ['Max drawdown', pct(indicators?.maxDrawdown)],
    ['3M return', pct(indicators?.return3M, 1, true)],
    ['Trend', indicators?.trend ?? '—'],
    ['Support / Resist.', indicators?.support ? `${num(indicators.support)} / ${num(indicators.resistance)}` : '—'],
  ]
  const hasMarketData = Boolean(quote || overview || history.length)

  return (
    <div className="stack">
      <div className="report-head">
        <div>
          <div className="row-gap">
            <span className="badge ok">✓ Report ready</span>
            <span className="badge mono">trace {result.traceId}</span>
            {overview?.sector && <span className="badge">{overview.sector}</span>}
          </div>
          <h2 style={{ marginTop: 10 }}>
            {overview?.name ?? report.symbol ?? report.query}
            {report.symbol && overview?.name && <span className="muted"> · {report.symbol}</span>}
          </h2>
          <div className="sub">{report.summary}</div>
        </div>
        {quote && (
          <div className="price">
            <div className="big">{money(quote.price, overview?.currency || 'USD')}</div>
            <div className={quote.change >= 0 ? 'up' : 'down'}>
              {quote.change >= 0 ? '▲' : '▼'} {num(Math.abs(quote.change))} ({pct(quote.changePercent, 2, true)})
            </div>
            <div className="sub">as of {quote.latestTradingDay}</div>
          </div>
        )}
      </div>

      {exec && (
        <div className="panel">
          <div className="panel-head">
            <h3>🏛️ Investment Committee Verdict</h3>
            <span className="meta">horizon: {exec.timeHorizon}</span>
          </div>
          <div className="panel-body verdict">
            <div className="rating-card">
              <div className="label">Rating</div>
              <div className="rating" style={{ color: RATING_COLOR[exec.rating] }}>
                {exec.rating}
              </div>
              <div className="meter" aria-label={`Confidence ${exec.confidence}%`}>
                <div style={{ width: `${exec.confidence}%` }} />
              </div>
              <div className="sub" style={{ marginTop: 6, fontSize: 12.5 }}>
                {exec.confidence}% confidence
              </div>
            </div>
            <div>
              <p className="thesis">{exec.thesis}</p>
              <div className="bullets">
                <div>
                  <h4>Key points</h4>
                  <ul>
                    {exec.keyPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Key risks</h4>
                  <ul>
                    {exec.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasMarketData && (
        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h3>📈 Price action · last {history.length} sessions</h3>
              <span className="meta">Alpha Vantage</span>
            </div>
            <div className="panel-body">
              <PriceChart history={history} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>🧮 Key metrics</h3>
            </div>
            <div className="panel-body kpis">
              {kpis
                .filter(([, v]) => v !== '—')
                .map(([k, v]) => (
                  <div className="kpi" key={k}>
                    <div className="k">{k}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="tabs" role="tablist">
          {TAB_ORDER.map((t) => {
            const s = report.sections[t.key]
            return (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                <span>{t.icon}</span> {t.label}
                {s && s.status !== 'completed' && <span className="badge fail">failed</span>}
              </button>
            )
          })}
          <button className={`tab ${tab === 'sources' ? 'active' : ''}`} onClick={() => setTab('sources')}>
            🔗 Sources <span className="badge">{report.sources.length}</span>
          </button>
          <button className={`tab ${tab === 'json' ? 'active' : ''}`} onClick={() => setTab('json')}>
            {'{ }'} JSON
          </button>
        </div>
        <div className="panel-body">
          {section &&
            (section.status === 'completed' ? (
              <>
                <div className="row-gap" style={{ marginBottom: 12 }}>
                  <span className="badge">{section.title}</span>
                  {section.model && <span className="badge mono">{section.model}</span>}
                  {section.durationMs !== undefined && <span className="badge mono">{(section.durationMs / 1000).toFixed(1)}s</span>}
                </div>
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.details}</ReactMarkdown>
                </div>
              </>
            ) : (
              <div className="callout error">This agent failed: {section.error}</div>
            ))}
          {!section && tab !== 'sources' && tab !== 'json' && <div className="empty">This analysis was not produced.</div>}
          {tab === 'sources' &&
            (report.sources.length ? (
              <div className="sources">
                {report.sources.map((s) => (
                  <a className="source" key={s.link} href={s.link} target="_blank" rel="noreferrer noopener">
                    <div className="t">{s.title}</div>
                    <div className="s">
                      {s.source}
                      {s.date ? ` · ${s.date}` : ''}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty">No web sources (add a Serper key to enable web research).</div>
            ))}
          {tab === 'json' && (
            <>
              <div className="row-gap" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="muted mono" style={{ fontSize: 12.5 }}>
                  GET /finance-result/{result.traceId}
                </span>
                <button className="btn btn-sm" onClick={download}>
                  ⬇ Download JSON
                </button>
              </div>
              <pre className="json">{JSON.stringify({ ...result, comprehensiveReport: { ...report, marketData: { ...report.marketData, history: `[${history.length} daily bars]` } } }, null, 2)}</pre>
            </>
          )}
        </div>
      </div>
      <div className="disclaimer">⚠️ {report.disclaimer}</div>
    </div>
  )
}
