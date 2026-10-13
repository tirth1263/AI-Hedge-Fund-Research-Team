import type {
  AnalysisSection,
  AnalysisType,
  ComprehensiveReport,
  CoordinatedData,
  ExecutiveSummary,
  Rating,
} from '../types'
import { buildDataContext, extractJson, stripThinking, summarize } from '../utils/helper-functions'

export interface NebiusConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
}

interface AgentPersona {
  title: string
  system: string
  instructions: string
}

const SHARED_RULES = `
Rules:
- Ground every claim in the MARKET DATA and WEB RESEARCH provided. Quote concrete numbers.
- If data is missing, say so explicitly instead of inventing figures.
- Write clean GitHub-flavored Markdown with "##" section headings, short paragraphs, bullet points and at most one table.
- Be decisive and specific, like an institutional research note. No filler, no disclaimers inside the body.
- Keep it under ~550 words.`

/** One persona per agent in the research team. */
export const AGENTS: Record<AnalysisType, AgentPersona> = {
  general: {
    title: 'General Market Analysis',
    system: 'You are the Head of Research at a multi-strategy hedge fund. You write the opening market brief that every specialist on the team reads first.',
    instructions: `Produce a market & company overview with these sections:
## Snapshot  (what the company does, where the stock trades now, one-line view)
## Market & Sector Context  (macro, rates, sector trend, competitive position)
## Recent Developments  (news catalysts from the web research, with dates when known)
## Key Questions for the Team  (3-5 questions the specialists must answer)`,
  },
  fundamental: {
    title: 'Fundamental Analysis',
    system: 'You are a senior fundamental equity analyst (CFA) focused on valuation and business quality.',
    instructions: `Produce a fundamental analysis with these sections:
## Valuation  (P/E, forward P/E, PEG, P/B, P/S versus history and peers; cheap or expensive?)
## Profitability & Quality  (margins, ROE, earnings quality, balance sheet signals)
## Growth Drivers  (revenue/earnings growth, products, markets)
## Fair Value View  (a reasoned fair value range or upside/downside versus the analyst target)
## Fundamental Verdict  (one of: Undervalued / Fairly valued / Overvalued, with 2-sentence rationale)`,
  },
  technical: {
    title: 'Technical Analysis',
    system: 'You are a veteran technical analyst and market strategist who reads price action, momentum and volume.',
    instructions: `Produce a technical analysis with these sections:
## Trend Structure  (price versus SMA20/SMA50 and the 50/200-day averages, overall trend)
## Momentum  (RSI, MACD; overbought/oversold, divergences)
## Key Levels  (support, resistance, Bollinger bands, 52-week range)
## Trade Setup  (entry zone, stop-loss, targets, risk/reward)
## Technical Signal  (one of: Bullish / Neutral / Bearish, with a short rationale)`,
  },
  risk: {
    title: 'Risk Assessment',
    system: 'You are the Chief Risk Officer of a hedge fund. You quantify downside and design protection.',
    instructions: `Produce a risk assessment with these sections:
## Market Risk  (volatility, beta, drawdown, Value-at-Risk interpretation)
## Business & Event Risks  (company, regulatory, competitive, macro; reference the news)
## Risk Matrix  (a table: Risk | Likelihood | Impact | Mitigation)
## Downside Protection  (stop levels, hedges such as options or pair trades, position limits)
## Risk Rating  (one of: Low / Moderate / Elevated / High, with a short rationale)`,
  },
  portfolio: {
    title: 'Portfolio Management Insights',
    system: 'You are a portfolio manager responsible for position sizing and allocation in a diversified long/short equity book.',
    instructions: `Produce portfolio recommendations with these sections:
## Recommendation  (Buy / Accumulate / Hold / Trim / Sell, and why)
## Position Sizing  (suggested weight for conservative, balanced and aggressive portfolios)
## Entry & Exit Plan  (scaling in, price triggers, rebalancing rules)
## Diversification  (correlation and concentration considerations, complementary holdings or ETFs)
## Monitoring Checklist  (the 4-6 metrics or events that would change the thesis)`,
  },
}

const RATINGS: Rating[] = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Thin client for Nebius AI Studio (OpenAI compatible chat completions API).
 * Uses `fetch` so it runs unchanged in Node and in the browser.
 */
export class NebiusAIService {
  constructor(
    private readonly config: NebiusConfig,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    if (!config.apiKey) throw new Error('NEBIUS_API_KEY is not configured')
  }

  get model(): string {
    return this.config.model
  }

  /** Qwen3 models think by default; "/no_think" keeps answers fast and clean. */
  private withThinkingSwitch(prompt: string): string {
    return /qwen3/i.test(this.config.model) && !/instruct/i.test(this.config.model) ? `${prompt}\n\n/no_think` : prompt
  }

  async chat(messages: ChatMessage[], options: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}) {
    const res = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2200,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Nebius API ${res.status}: ${body.slice(0, 300) || res.statusText}`)
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = json.choices?.[0]?.message?.content ?? ''
    const cleaned = stripThinking(content)
    if (!cleaned) throw new Error('Nebius API returned an empty response')
    return cleaned
  }

  /** Run one analysis agent (general or a specialist) against the coordinated data. */
  async analyze(type: AnalysisType, data: CoordinatedData, options: { generalContext?: string; signal?: AbortSignal } = {}): Promise<AnalysisSection> {
    const agent = AGENTS[type]
    const started = Date.now()
    const context = buildDataContext(data)
    const brief = options.generalContext
      ? `\n\n=== HEAD OF RESEARCH BRIEF ===\n${options.generalContext.slice(0, 3500)}`
      : ''

    try {
      const details = await this.chat(
        [
          { role: 'system', content: `${agent.system}\n${SHARED_RULES}` },
          {
            role: 'user',
            content: this.withThinkingSwitch(`${context}${brief}\n\n=== YOUR TASK ===\n${agent.instructions}`),
          },
        ],
        { signal: options.signal },
      )
      return {
        type,
        title: agent.title,
        status: 'completed',
        summary: summarize(details),
        details,
        model: this.config.model,
        durationMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      return {
        type,
        title: agent.title,
        status: 'failed',
        summary: 'Analysis failed',
        details: '',
        error: (err as Error).message,
        model: this.config.model,
        durationMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /** Portfolio-committee style synthesis of all completed analyses into a rating. */
  async executiveSummary(
    report: Pick<ComprehensiveReport, 'query' | 'symbol' | 'sections'>,
    signal?: AbortSignal,
  ): Promise<ExecutiveSummary | undefined> {
    const digest = Object.values(report.sections)
      .filter((s) => s && s.status === 'completed')
      .map((s) => `### ${s!.title}\n${s!.details.slice(0, 2200)}`)
      .join('\n\n')
    if (!digest) return undefined

    const prompt = `You chair the investment committee. Synthesize the team's research on "${report.query}"${report.symbol ? ` (${report.symbol})` : ''} into a final call.

${digest}

Respond with ONLY a JSON object, no prose, matching:
{"rating": one of ${JSON.stringify(RATINGS)}, "confidence": integer 0-100, "thesis": "2-3 sentence investment thesis", "keyPoints": ["3-5 short bullet points"], "risks": ["2-4 key risks"], "timeHorizon": "e.g. 6-12 months"}`

    const text = await this.chat(
      [
        { role: 'system', content: 'You are a precise investment committee chair. You output strict JSON only.' },
        { role: 'user', content: this.withThinkingSwitch(prompt) },
      ],
      { maxTokens: 900, temperature: 0.2, signal },
    )
    const parsed = extractJson<Partial<ExecutiveSummary>>(text)
    if (!parsed || !parsed.thesis) return undefined
    const rating = RATINGS.find((r) => r.toLowerCase() === String(parsed.rating ?? '').toLowerCase()) ?? 'Hold'
    return {
      rating,
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 50))),
      thesis: String(parsed.thesis),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String).slice(0, 6) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 5) : [],
      timeHorizon: String(parsed.timeHorizon ?? '6-12 months'),
    }
  }

  /** List models available to this key (used by the web dashboard model picker). */
  async listModels(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    })
    if (!res.ok) throw new Error(`Nebius API ${res.status}`)
    const json = (await res.json()) as { data?: { id: string }[] }
    return (json.data ?? []).map((m) => m.id).sort()
  }
}
