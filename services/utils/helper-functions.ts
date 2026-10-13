import type { AnalysisSection, AnalysisType, ComprehensiveReport, CoordinatedData, PricePoint, TechnicalIndicators } from '../types'
import { DISCLAIMER } from '../types'

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

/** Parse an Alpha Vantage style numeric string ("123.45", "12.3%", "None", "-"). */
export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const cleaned = String(value).replace(/[%,$\s]/g, '')
  if (!cleaned || cleaned === 'None' || cleaned === '-') return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

const STOP_WORDS = new Set([
  'A', 'I', 'AI', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BUY', 'BY', 'CEO', 'DO', 'EPS', 'ETF', 'FOR', 'GDP',
  'HOLD', 'HOW', 'IN', 'IPO', 'IS', 'IT', 'ME', 'MY', 'NEW', 'NOW', 'OF', 'ON', 'OR', 'PE', 'SELL', 'SHOULD',
  'THE', 'TO', 'US', 'USA', 'USD', 'VS', 'WHAT', 'WHY', 'YOY', 'Q1', 'Q2', 'Q3', 'Q4', 'ROI', 'ROE', 'EV',
])

/**
 * Try to extract a ticker symbol from free-form text, e.g.
 * "AAPL stock analysis" -> "AAPL", "$TSLA outlook" -> "TSLA", "BRK.B" -> "BRK.B".
 */
export function extractTicker(query: string): string | null {
  const dollar = query.match(/\$([A-Za-z]{1,5}(?:\.[A-Za-z]{1,2})?)\b/)
  if (dollar) return dollar[1].toUpperCase()

  const candidates = query.match(/\b[A-Z]{1,5}(?:\.[A-Z]{1,2})?\b/g) ?? []
  const ticker = candidates.find((c) => !STOP_WORDS.has(c))
  return ticker ?? null
}

/** Remove the analysis-type noise words so a company name can be searched. */
export function extractCompanyKeywords(query: string): string {
  return query
    .replace(/\b(stock|stocks|share|shares|analysis|analyze|outlook|forecast|price|target|investment|invest|company|should|i|buy|sell|hold|in|the|of|for|a|an|is|good|now|202\d)\b/gi, ' ')
    .replace(/[^\w\s.&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ------------------------------------------------------------------ */
/* Technical indicators (computed locally from daily prices)           */
/* ------------------------------------------------------------------ */

const round = (n: number | undefined, digits = 2) =>
  n === undefined || !Number.isFinite(n) ? undefined : Number(n.toFixed(digits))

function sma(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined
  const slice = values.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out.push(prev)
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function rsi(values: number[], period = 14): number | undefined {
  if (values.length <= period) return undefined
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1)
  return Math.sqrt(variance)
}

/** Compute a compact set of technical + risk indicators from oldest-first prices. */
export function computeIndicators(history: PricePoint[]): TechnicalIndicators | undefined {
  if (history.length < 15) return undefined
  const closes = history.map((p) => p.close)
  const last = closes[closes.length - 1]

  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) returns.push(closes[i] / closes[i - 1] - 1)

  const ema12 = emaSeries(closes, 12)
  const ema26 = emaSeries(closes, 26)
  const sma20 = sma(closes, 20)
  const sd20 = closes.length >= 20 ? stdDev(closes.slice(-20)) : undefined
  const sma50 = sma(closes, 50)

  let peak = closes[0]
  let maxDrawdown = 0
  for (const c of closes) {
    peak = Math.max(peak, c)
    maxDrawdown = Math.min(maxDrawdown, c / peak - 1)
  }

  const sortedReturns = [...returns].sort((a, b) => a - b)
  const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)]

  const recent = history.slice(-20)
  const support = Math.min(...recent.map((p) => p.low))
  const resistance = Math.max(...recent.map((p) => p.high))

  const ret = (days: number) => (closes.length > days ? last / closes[closes.length - 1 - days] - 1 : undefined)

  let trend: TechnicalIndicators['trend'] = 'sideways'
  if (sma20 && sma50) {
    if (last > sma20 && sma20 > sma50) trend = 'uptrend'
    else if (last < sma20 && sma20 < sma50) trend = 'downtrend'
  }

  const e12 = ema12[ema12.length - 1]
  const e26 = ema26[ema26.length - 1]

  return {
    sma20: round(sma20),
    sma50: round(sma50),
    ema12: round(e12),
    ema26: round(e26),
    macd: e12 !== undefined && e26 !== undefined ? round(e12 - e26, 3) : undefined,
    rsi14: round(rsi(closes, 14), 1),
    bollingerUpper: sma20 !== undefined && sd20 !== undefined ? round(sma20 + 2 * sd20) : undefined,
    bollingerLower: sma20 !== undefined && sd20 !== undefined ? round(sma20 - 2 * sd20) : undefined,
    annualizedVolatility: round(stdDev(returns) * Math.sqrt(252) * 100, 1),
    return1M: round((ret(21) ?? NaN) * 100, 1),
    return3M: round((ret(63) ?? NaN) * 100, 1),
    maxDrawdown: round(maxDrawdown * 100, 1),
    valueAtRisk95: var95 !== undefined ? round(var95 * 100, 2) : undefined,
    support: round(support),
    resistance: round(resistance),
    trend,
  }
}

/* ------------------------------------------------------------------ */
/* LLM output helpers                                                  */
/* ------------------------------------------------------------------ */

/** Strip reasoning blocks (<think>...</think>) that some models (Qwen3, DeepSeek-R1) emit. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '') // unterminated opening tag cut by the provider
    .replace(/<think>[\s\S]*$/i, '') // response truncated while still thinking
    .trim()
}

/** Build a short plain-text summary from a markdown analysis. */
export function summarize(markdown: string, maxLength = 320): string {
  const plain = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('|') && !/^[-*_]{3,}$/.test(l))
    .join(' ')
    .replace(/[*_`>#]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLength) return plain
  const cut = plain.slice(0, maxLength)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/** Extract the first JSON object from a model response. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Prompt context                                                      */
/* ------------------------------------------------------------------ */

const fmt = (n: number | undefined, suffix = '') => (n === undefined ? 'n/a' : `${n.toLocaleString('en-US')}${suffix}`)

export function formatLargeNumber(n: number | undefined): string {
  if (n === undefined) return 'n/a'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

/** Render the collected market data + web research as compact text for the LLM prompts. */
export function buildDataContext(data: CoordinatedData): string {
  const { financeData: fd, webSearch: ws } = data
  const lines: string[] = [`USER QUERY: ${data.query}`, `DATE: ${new Date().toISOString().slice(0, 10)}`, '']

  lines.push('=== MARKET DATA (Alpha Vantage) ===')
  if (fd.status !== 'completed' || (!fd.quote && !fd.overview)) {
    lines.push(`Market data unavailable${fd.error ? ` (${fd.error})` : ''}. Rely on web research and general knowledge, and say so.`)
  } else {
    lines.push(`Symbol: ${fd.symbol}`)
    if (fd.overview) {
      const o = fd.overview
      lines.push(
        `Company: ${o.name} | Sector: ${o.sector ?? 'n/a'} | Industry: ${o.industry ?? 'n/a'} | Exchange: ${o.exchange ?? 'n/a'}`,
        `Market cap: ${formatLargeNumber(o.marketCap)} | Revenue TTM: ${formatLargeNumber(o.revenueTTM)}`,
        `P/E: ${fmt(o.peRatio)} | Forward P/E: ${fmt(o.forwardPE)} | PEG: ${fmt(o.pegRatio)} | P/B: ${fmt(o.priceToBook)} | P/S: ${fmt(o.priceToSales)}`,
        `EPS: ${fmt(o.eps)} | Profit margin: ${fmt(o.profitMargin !== undefined ? +(o.profitMargin * 100).toFixed(1) : undefined, '%')} | ROE: ${fmt(o.returnOnEquity !== undefined ? +(o.returnOnEquity * 100).toFixed(1) : undefined, '%')}`,
        `Revenue growth YoY: ${fmt(o.revenueGrowthYoY !== undefined ? +(o.revenueGrowthYoY * 100).toFixed(1) : undefined, '%')} | Earnings growth YoY: ${fmt(o.earningsGrowthYoY !== undefined ? +(o.earningsGrowthYoY * 100).toFixed(1) : undefined, '%')}`,
        `Dividend yield: ${fmt(o.dividendYield !== undefined ? +(o.dividendYield * 100).toFixed(2) : undefined, '%')} | Beta: ${fmt(o.beta)} | Analyst target: ${fmt(o.analystTargetPrice)}`,
        `52w range: ${fmt(o.week52Low)} - ${fmt(o.week52High)} | 50d MA: ${fmt(o.movingAverage50)} | 200d MA: ${fmt(o.movingAverage200)}`,
      )
    }
    if (fd.quote) {
      const q = fd.quote
      lines.push(
        `Price: ${q.price} (${q.change >= 0 ? '+' : ''}${q.change} / ${q.changePercent}%) on ${q.latestTradingDay} | Volume: ${formatLargeNumber(q.volume)}`,
      )
    }
    if (fd.indicators) {
      const i = fd.indicators
      lines.push(
        `Technicals: SMA20 ${fmt(i.sma20)}, SMA50 ${fmt(i.sma50)}, RSI14 ${fmt(i.rsi14)}, MACD ${fmt(i.macd)}, Bollinger ${fmt(i.bollingerLower)}-${fmt(i.bollingerUpper)}, trend ${i.trend}`,
        `Risk: annualized vol ${fmt(i.annualizedVolatility, '%')}, max drawdown (~100d) ${fmt(i.maxDrawdown, '%')}, 1-day VaR95 ${fmt(i.valueAtRisk95, '%')}, 1M return ${fmt(i.return1M, '%')}, 3M return ${fmt(i.return3M, '%')}`,
        `20-day support ${fmt(i.support)} / resistance ${fmt(i.resistance)}`,
      )
    }
  }

  lines.push('', '=== WEB RESEARCH (Serper / Google) ===')
  const items = [...ws.news.map((n) => ({ ...n, kind: 'NEWS' })), ...ws.results.map((r) => ({ ...r, kind: 'WEB' }))]
  if (!items.length) {
    lines.push(`No web results${ws.error ? ` (${ws.error})` : ''}.`)
  } else {
    items.slice(0, 12).forEach((r, idx) => {
      lines.push(`[${idx + 1}] (${r.kind}${r.date ? `, ${r.date}` : ''}) ${r.title} - ${r.snippet}`)
    })
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Report assembly                                                     */
/* ------------------------------------------------------------------ */

const SECTION_ORDER: AnalysisType[] = ['general', 'fundamental', 'technical', 'risk', 'portfolio']

/** Merge the coordinated data and every agent section into the final report. */
export function assembleReport(
  traceId: string,
  data: CoordinatedData,
  sectionList: (AnalysisSection | null | undefined)[],
): ComprehensiveReport {
  const sections: ComprehensiveReport['sections'] = {}
  for (const type of SECTION_ORDER) {
    const section = sectionList.find((s) => s?.type === type)
    if (section) sections[type] = section
  }
  const completed = SECTION_ORDER.filter((t) => sections[t]?.status === 'completed')
  const failed = SECTION_ORDER.filter((t) => sections[t] && sections[t]!.status !== 'completed')
  const fd = data.financeData
  const name = fd.overview?.name ?? fd.symbol ?? data.query

  return {
    traceId,
    query: data.query,
    symbol: fd.symbol,
    summary: `Comprehensive Financial Analysis Report for ${name}: ${completed.length}/${SECTION_ORDER.length} analyses completed${failed.length ? ` (${failed.join(', ')} failed)` : ''}.`,
    sections,
    marketData: {
      quote: fd.quote,
      overview: fd.overview,
      indicators: fd.indicators,
      history: fd.history,
    },
    sources: [...data.webSearch.news, ...data.webSearch.results].slice(0, 16),
    completedAnalyses: completed,
    failedAnalyses: failed,
    disclaimer: DISCLAIMER,
    timestamp: new Date().toISOString(),
  }
}
