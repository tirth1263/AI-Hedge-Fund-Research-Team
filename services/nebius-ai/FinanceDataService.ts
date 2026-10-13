import type { CompanyOverview, FinanceData, PricePoint, Quote } from '../types'
import { computeIndicators, extractCompanyKeywords, extractTicker, toNumber } from '../utils/helper-functions'

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query'

/** Alpha Vantage's free tier allows roughly one request per second. */
const REQUEST_SPACING_MS = 1100

type AlphaVantageResponse = Record<string, any>

export class AlphaVantageLimitError extends Error {}

/**
 * Collects real-time quote, company fundamentals and ~100 days of price history
 * from Alpha Vantage, then derives technical/risk indicators locally.
 *
 * Works in Node (Motia steps) and in the browser (Alpha Vantage sends CORS headers).
 */
export class FinanceDataService {
  private lastRequestAt = 0

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  private async request(params: Record<string, string>): Promise<AlphaVantageResponse> {
    const wait = this.lastRequestAt + REQUEST_SPACING_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.lastRequestAt = Date.now()

    const url = `${ALPHA_VANTAGE_URL}?${new URLSearchParams({ ...params, apikey: this.apiKey ?? '' })}`
    const res = await this.fetchImpl(url)
    if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`)
    const json = (await res.json()) as AlphaVantageResponse
    if (json['Error Message']) throw new Error(`Alpha Vantage: ${json['Error Message']}`)
    const limit = json['Note'] ?? json['Information']
    if (limit && Object.keys(json).length === 1) throw new AlphaVantageLimitError(`Alpha Vantage: ${limit}`)
    return json
  }

  /** Resolve a ticker from the query, falling back to Alpha Vantage symbol search. */
  async resolveSymbol(query: string): Promise<string | null> {
    const direct = extractTicker(query)
    if (direct) return direct
    const keywords = extractCompanyKeywords(query)
    if (!keywords) return null
    const json = await this.request({ function: 'SYMBOL_SEARCH', keywords })
    const matches: AlphaVantageResponse[] = json.bestMatches ?? []
    const best = matches.find((m) => m['4. region'] === 'United States') ?? matches[0]
    return best ? String(best['1. symbol']) : null
  }

  async getQuote(symbol: string): Promise<Quote | undefined> {
    const json = await this.request({ function: 'GLOBAL_QUOTE', symbol })
    const q = json['Global Quote']
    if (!q || !q['05. price']) return undefined
    return {
      symbol: q['01. symbol'],
      open: toNumber(q['02. open']) ?? 0,
      high: toNumber(q['03. high']) ?? 0,
      low: toNumber(q['04. low']) ?? 0,
      price: toNumber(q['05. price']) ?? 0,
      volume: toNumber(q['06. volume']) ?? 0,
      latestTradingDay: q['07. latest trading day'],
      previousClose: toNumber(q['08. previous close']) ?? 0,
      change: toNumber(q['09. change']) ?? 0,
      changePercent: toNumber(q['10. change percent']) ?? 0,
    }
  }

  async getOverview(symbol: string): Promise<CompanyOverview | undefined> {
    const o = await this.request({ function: 'OVERVIEW', symbol })
    if (!o || !o.Symbol) return undefined
    return {
      symbol: o.Symbol,
      name: o.Name,
      description: o.Description,
      exchange: o.Exchange,
      currency: o.Currency,
      sector: o.Sector,
      industry: o.Industry,
      marketCap: toNumber(o.MarketCapitalization),
      peRatio: toNumber(o.PERatio),
      forwardPE: toNumber(o.ForwardPE),
      pegRatio: toNumber(o.PEGRatio),
      priceToBook: toNumber(o.PriceToBookRatio),
      priceToSales: toNumber(o.PriceToSalesRatioTTM),
      eps: toNumber(o.EPS),
      dividendYield: toNumber(o.DividendYield),
      profitMargin: toNumber(o.ProfitMargin),
      operatingMargin: toNumber(o.OperatingMarginTTM),
      returnOnEquity: toNumber(o.ReturnOnEquityTTM),
      revenueTTM: toNumber(o.RevenueTTM),
      revenueGrowthYoY: toNumber(o.QuarterlyRevenueGrowthYOY),
      earningsGrowthYoY: toNumber(o.QuarterlyEarningsGrowthYOY),
      beta: toNumber(o.Beta),
      week52High: toNumber(o['52WeekHigh']),
      week52Low: toNumber(o['52WeekLow']),
      movingAverage50: toNumber(o['50DayMovingAverage']),
      movingAverage200: toNumber(o['200DayMovingAverage']),
      analystTargetPrice: toNumber(o.AnalystTargetPrice),
    }
  }

  /** ~100 most recent trading days, oldest first. */
  async getDailyHistory(symbol: string): Promise<PricePoint[]> {
    const json = await this.request({ function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact' })
    const series: Record<string, Record<string, string>> = json['Time Series (Daily)'] ?? {}
    return Object.entries(series)
      .map(([date, v]) => ({
        date,
        open: toNumber(v['1. open']) ?? 0,
        high: toNumber(v['2. high']) ?? 0,
        low: toNumber(v['3. low']) ?? 0,
        close: toNumber(v['4. close']) ?? 0,
        volume: toNumber(v['5. volume']) ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Fetch everything for a query. Never throws: partial failures become warnings
   * so the rest of the workflow can continue (graceful degradation).
   */
  async collect(query: string): Promise<FinanceData> {
    const base: FinanceData = { query, symbol: null, status: 'completed', history: [], warnings: [], timestamp: '' }

    if (!this.isConfigured) {
      return { ...base, status: 'skipped', error: 'ALPHA_VANTAGE_KEY not configured', timestamp: new Date().toISOString() }
    }

    try {
      base.symbol = await this.resolveSymbol(query)
    } catch (err) {
      base.warnings.push(`Symbol search failed: ${(err as Error).message}`)
    }
    if (!base.symbol) {
      return { ...base, status: 'skipped', error: 'No ticker symbol found in query', timestamp: new Date().toISOString() }
    }

    const symbol = base.symbol
    const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn()
      } catch (err) {
        base.warnings.push(`${label}: ${(err as Error).message}`)
        return undefined
      }
    }

    base.quote = await attempt('Quote', () => this.getQuote(symbol))
    base.overview = await attempt('Overview', () => this.getOverview(symbol))
    base.history = (await attempt('Price history', () => this.getDailyHistory(symbol))) ?? []
    base.indicators = computeIndicators(base.history)

    // Fall back to the latest bar when the quote endpoint was rate limited.
    if (!base.quote && base.history.length > 1) {
      const last = base.history[base.history.length - 1]
      const prev = base.history[base.history.length - 2]
      base.quote = {
        symbol,
        price: last.close,
        open: last.open,
        high: last.high,
        low: last.low,
        previousClose: prev.close,
        change: Number((last.close - prev.close).toFixed(2)),
        changePercent: Number(((last.close / prev.close - 1) * 100).toFixed(2)),
        volume: last.volume,
        latestTradingDay: last.date,
      }
    }

    const gotAnything = Boolean(base.quote || base.overview || base.history.length)
    return {
      ...base,
      status: gotAnything ? 'completed' : 'failed',
      error: gotAnything ? undefined : base.warnings.join('; ') || 'No market data returned',
      timestamp: new Date().toISOString(),
    }
  }
}
