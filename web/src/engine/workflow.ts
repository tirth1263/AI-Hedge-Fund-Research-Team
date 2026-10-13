import { FinanceDataService } from '@services/nebius-ai/FinanceDataService'
import { NebiusAIService } from '@services/nebius-ai/NebiusAIService'
import {
  SPECIALISTS,
  type AnalysisSection,
  type ComprehensiveReport,
  type CoordinatedData,
  type FinanceResult,
  type SpecialistType,
} from '@services/types'
import { assembleReport } from '@services/utils/helper-functions'
import { WebSearchService } from '@services/utils/WebSearchService'
import type { Settings } from '../lib/settings'

/** Step ids mirror the Motia step names in /steps so the UI reads like the Workbench. */
export type StepId =
  | 'FinanceQueryAPI'
  | 'FinanceDataAgent'
  | 'WebSearchAgent'
  | 'ResponseCoordinator'
  | 'NebiusAIAnalysis'
  | 'TechnicalAnalyst'
  | 'RiskManager'
  | 'FundamentalAnalyst'
  | 'PortfolioManager'
  | 'ParallelAnalysisCoordinator'
  | 'SaveResult'
  | 'FinanceResultAPI'

export type StepState = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

export interface StepTrace {
  id: StepId
  state: StepState
  start?: number
  end?: number
  note?: string
}

export interface LogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  step: StepId
  message: string
}

export interface WorkflowCallbacks {
  onStep: (trace: StepTrace) => void
  onLog: (entry: LogEntry) => void
}

export const SPECIALIST_STEP: Record<SpecialistType, StepId> = {
  technical: 'TechnicalAnalyst',
  risk: 'RiskManager',
  fundamental: 'FundamentalAnalyst',
  portfolio: 'PortfolioManager',
}

/** Motia style trace id, e.g. "F4GB8-5011529". */
export function createTraceId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  const prefix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${prefix}-${String(Date.now()).slice(-7)}`
}

class Tracer {
  constructor(private readonly cb: WorkflowCallbacks) {}

  log(step: StepId, level: LogEntry['level'], message: string) {
    this.cb.onLog({ time: Date.now(), level, step, message })
  }

  /** Run a step, reporting running/finished state and timing. */
  async step<T>(id: StepId, fn: () => Promise<T>, stateOf?: (result: T) => StepState, noteOf?: (result: T) => string | undefined): Promise<T> {
    const start = Date.now()
    this.cb.onStep({ id, state: 'running', start })
    try {
      const result = await fn()
      this.cb.onStep({ id, state: stateOf?.(result) ?? 'completed', start, end: Date.now(), note: noteOf?.(result) })
      return result
    } catch (err) {
      this.cb.onStep({ id, state: 'failed', start, end: Date.now(), note: (err as Error).message })
      this.log(id, 'error', (err as Error).message)
      throw err
    }
  }
}

const sectionState = (s: AnalysisSection): StepState => (s.status === 'completed' ? 'completed' : 'failed')

/**
 * Browser implementation of the Motia workflow in /steps.
 * Same services, same prompts, same data contract; the browser talks to
 * Nebius, Alpha Vantage and Serper directly with the visitor's own keys.
 */
export async function runBrowserWorkflow(query: string, settings: Settings, cb: WorkflowCallbacks): Promise<FinanceResult> {
  const traceId = createTraceId()
  const createdAt = new Date().toISOString()
  const t = new Tracer(cb)

  await t.step('FinanceQueryAPI', async () => {
    t.log('FinanceQueryAPI', 'info', `Finance query received: "${query}" (traceId ${traceId})`)
  })

  const nebius = new NebiusAIService({ apiKey: settings.nebiusKey, baseUrl: settings.baseUrl, model: settings.model })
  const finance = new FinanceDataService(settings.alphaVantageKey || undefined)
  const web = new WebSearchService(settings.serperKey || undefined)

  // Parallel data collection (query-received fan-out).
  const [financeData, webSearch] = await Promise.all([
    t.step(
      'FinanceDataAgent',
      async () => {
        t.log('FinanceDataAgent', 'info', finance.isConfigured ? 'Fetching quote, fundamentals and price history from Alpha Vantage' : 'No Alpha Vantage key, skipping market data')
        const data = await finance.collect(query)
        data.warnings.forEach((w) => t.log('FinanceDataAgent', 'warn', w))
        if (data.status === 'completed') t.log('FinanceDataAgent', 'info', `Market data collected for ${data.symbol} (${data.history.length} daily bars)`)
        else t.log('FinanceDataAgent', 'warn', `Continuing without market data: ${data.error}`)
        return data
      },
      (d) => (d.status === 'completed' ? 'completed' : d.status === 'skipped' ? 'skipped' : 'failed'),
      (d) => d.symbol ?? d.error,
    ),
    t.step(
      'WebSearchAgent',
      async () => {
        t.log('WebSearchAgent', 'info', web.isConfigured ? 'Searching the web and news with Serper' : 'No Serper key, skipping web search')
        const data = await web.search(query)
        if (data.status === 'completed') t.log('WebSearchAgent', 'info', `Found ${data.results.length} web results and ${data.news.length} news articles`)
        else t.log('WebSearchAgent', 'warn', `Continuing without web research: ${data.error}`)
        return data
      },
      (d) => (d.status === 'completed' ? 'completed' : d.status === 'skipped' ? 'skipped' : 'failed'),
      (d) => (d.status === 'completed' ? `${d.results.length + d.news.length} sources` : d.error),
    ),
  ])

  const coordinated = await t.step('ResponseCoordinator', async (): Promise<CoordinatedData> => {
    t.log('ResponseCoordinator', 'info', `Web search ${webSearch.status}, finance data ${financeData.status}: data coordinated`)
    return { query, webSearch, financeData, timestamp: new Date().toISOString() }
  })

  const general = await t.step(
    'NebiusAIAnalysis',
    async () => {
      t.log('NebiusAIAnalysis', 'info', `Running general market analysis with ${nebius.model}`)
      const section = await nebius.analyze('general', coordinated)
      if (section.status === 'completed') t.log('NebiusAIAnalysis', 'info', `General analysis completed in ${((section.durationMs ?? 0) / 1000).toFixed(1)}s`)
      else t.log('NebiusAIAnalysis', 'warn', `General analysis failed, specialists continue without it: ${section.error}`)
      return section
    },
    sectionState,
    (s) => s.error,
  )

  // Parallel specialist analyses (parallel-analysis-requested fan-out).
  const specialists = await Promise.all(
    SPECIALISTS.map((type) =>
      t.step(
        SPECIALIST_STEP[type],
        async () => {
          t.log(SPECIALIST_STEP[type], 'info', `Starting ${type} analysis`)
          const section = await nebius.analyze(type, coordinated, {
            generalContext: general.status === 'completed' ? general.details : undefined,
          })
          if (section.status === 'completed') t.log(SPECIALIST_STEP[type], 'info', `${type} analysis completed in ${((section.durationMs ?? 0) / 1000).toFixed(1)}s`)
          else t.log(SPECIALIST_STEP[type], 'error', `${type} analysis failed: ${section.error}`)
          return section
        },
        sectionState,
        (s) => s.error,
      ),
    ),
  )

  const report = await t.step('ParallelAnalysisCoordinator', async (): Promise<ComprehensiveReport> => {
    const r = assembleReport(traceId, coordinated, [general, ...specialists])
    if (!r.completedAnalyses.length) {
      throw new Error(specialists.find((s) => s.error)?.error ?? general.error ?? 'All analyses failed')
    }
    t.log('ParallelAnalysisCoordinator', 'info', `${r.completedAnalyses.length}/5 analyses completed, building investment committee summary`)
    try {
      r.executiveSummary = await nebius.executiveSummary(r)
      if (r.executiveSummary) t.log('ParallelAnalysisCoordinator', 'info', `Committee rating: ${r.executiveSummary.rating} (${r.executiveSummary.confidence}% confidence)`)
    } catch (err) {
      t.log('ParallelAnalysisCoordinator', 'warn', `Executive summary failed: ${(err as Error).message}`)
    }
    return r
  })

  const result: FinanceResult = {
    traceId,
    status: 'completed',
    query,
    comprehensiveReport: report,
    createdAt,
    updatedAt: new Date().toISOString(),
  }

  await t.step('SaveResult', async () => {
    t.log('SaveResult', 'info', 'Comprehensive report saved to local history')
  })
  await t.step('FinanceResultAPI', async () => {
    t.log('FinanceResultAPI', 'info', `Result available for traceId ${traceId}`)
  })
  return result
}

/* ------------------------------------------------------------------ */
/* Server mode: drive a deployed Motia backend over its REST API       */
/* ------------------------------------------------------------------ */

const PROGRESS_STEP: Record<string, StepId> = {
  financeData: 'FinanceDataAgent',
  webSearch: 'WebSearchAgent',
  general: 'NebiusAIAnalysis',
  technical: 'TechnicalAnalyst',
  risk: 'RiskManager',
  fundamental: 'FundamentalAnalyst',
  portfolio: 'PortfolioManager',
}

const toStepState = (s: string): StepState =>
  s === 'completed' ? 'completed' : s === 'failed' ? 'failed' : s === 'skipped' ? 'skipped' : 'running'

export async function runServerWorkflow(query: string, serverUrl: string, cb: WorkflowCallbacks, signal?: AbortSignal): Promise<FinanceResult> {
  const base = serverUrl.replace(/\/$/, '')
  const t0 = Date.now()
  const states = new Map<StepId, StepState>()
  const set = (id: StepId, state: StepState) => {
    if (states.get(id) === state) return
    states.set(id, state)
    cb.onStep({ id, state, start: t0, end: state === 'running' ? undefined : Date.now() })
    if (state !== 'running') cb.onLog({ time: Date.now(), level: state === 'failed' ? 'error' : 'info', step: id, message: `${id} ${state}` })
  }

  set('FinanceQueryAPI', 'running')
  const res = await fetch(`${base}/finance-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  const started = await res.json()
  if (!res.ok) {
    set('FinanceQueryAPI', 'failed')
    throw new Error(started.error ?? `Server returned ${res.status}`)
  }
  set('FinanceQueryAPI', 'completed')
  cb.onLog({ time: Date.now(), level: 'info', step: 'FinanceQueryAPI', message: `Workflow started on ${base} (traceId ${started.traceId})` })

  for (let attempt = 0; attempt < 150; attempt++) {
    await new Promise((r) => setTimeout(r, 2000))
    if (signal?.aborted) throw new Error('Cancelled')
    const poll = await fetch(`${base}/finance-result/${started.traceId}`, { signal })
    const body = (await poll.json()) as FinanceResult & { progress?: Record<string, string> }
    const p = body.progress ?? {}

    for (const [key, step] of Object.entries(PROGRESS_STEP)) {
      const v = p[key]
      if (v && v !== 'pending') set(step, toStepState(v))
      else if (key === 'financeData' || key === 'webSearch') set(step, 'running')
      else if (key === 'general' && p.financeData !== 'pending' && p.webSearch !== 'pending') set(step, 'running')
      else if (key !== 'general' && p.general && p.general !== 'pending') set(step, 'running')
    }
    if (p.financeData !== 'pending' && p.webSearch !== 'pending') set('ResponseCoordinator', 'completed')

    if (body.status !== 'processing') {
      const ok = body.status === 'completed'
      set('ParallelAnalysisCoordinator', ok ? 'completed' : 'failed')
      set('SaveResult', 'completed')
      set('FinanceResultAPI', 'completed')
      if (!ok) throw new Error(body.error ?? 'Workflow failed')
      return body
    }
  }
  throw new Error('Timed out waiting for the server workflow')
}
