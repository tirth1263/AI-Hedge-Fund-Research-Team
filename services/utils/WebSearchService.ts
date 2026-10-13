import type { SearchResult, WebSearchData } from '../types'

const SERPER_URL = 'https://google.serper.dev'

interface SerperItem {
  title?: string
  link?: string
  snippet?: string
  source?: string
  date?: string
}

/**
 * Google web + news search through Serper.dev.
 * Works in Node and in the browser (Serper sends CORS headers).
 */
export class WebSearchService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  private async post(endpoint: 'search' | 'news', q: string, num: number): Promise<SerperItem[]> {
    const res = await this.fetchImpl(`${SERPER_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-KEY': this.apiKey ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num }),
    })
    if (!res.ok) throw new Error(`Serper ${endpoint} HTTP ${res.status}`)
    const json = (await res.json()) as { organic?: SerperItem[]; news?: SerperItem[] }
    return (endpoint === 'news' ? json.news : json.organic) ?? []
  }

  private static hostname(link: string): string {
    try {
      return new URL(link).hostname.replace(/^www\./, '')
    } catch {
      return link
    }
  }

  private static normalize(items: SerperItem[]): SearchResult[] {
    return items
      .filter((i) => i.title && i.link)
      .map((i) => ({
        title: i.title!,
        link: i.link!,
        snippet: i.snippet ?? '',
        source: i.source ?? WebSearchService.hostname(i.link!),
        date: i.date,
      }))
  }

  /** Search the web and news for the query. Never throws (graceful degradation). */
  async search(query: string): Promise<WebSearchData> {
    const timestamp = () => new Date().toISOString()
    if (!this.isConfigured) {
      return { query, status: 'skipped', results: [], news: [], error: 'SERPER_API_KEY not configured', timestamp: timestamp() }
    }

    const searchQuery = `${query} stock financial analysis outlook`
    const [web, news] = await Promise.allSettled([this.post('search', searchQuery, 8), this.post('news', query, 8)])

    const results = web.status === 'fulfilled' ? WebSearchService.normalize(web.value) : []
    const newsItems = news.status === 'fulfilled' ? WebSearchService.normalize(news.value) : []
    const errors = [web, news]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason?.message ?? r.reason))

    return {
      query: searchQuery,
      status: results.length || newsItems.length ? 'completed' : 'failed',
      results,
      news: newsItems,
      error: errors.length ? errors.join('; ') : undefined,
      timestamp: timestamp(),
    }
  }
}
