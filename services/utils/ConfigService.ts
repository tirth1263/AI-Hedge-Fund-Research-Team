import type { NebiusConfig } from '../nebius-ai/NebiusAIService'

export interface AppConfig {
  nebius: NebiusConfig
  alphaVantageKey?: string
  serperApiKey?: string
}

/**
 * Centralised access to environment configuration (Node / Motia only).
 * Accepts both ALPHA_VANTAGE_KEY and the legacy ALPHA_VINTAGE_KEY spelling.
 */
export class ConfigService {
  private static cached: AppConfig | null = null

  static get(): AppConfig {
    if (this.cached) return this.cached
    const env = process.env
    this.cached = {
      nebius: {
        apiKey: env.NEBIUS_API_KEY ?? '',
        baseUrl: env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
        model: env.NEBIUS_MODEL || 'Qwen/Qwen3-14B',
        temperature: env.NEBIUS_TEMPERATURE ? Number(env.NEBIUS_TEMPERATURE) : 0.4,
        maxTokens: env.NEBIUS_MAX_TOKENS ? Number(env.NEBIUS_MAX_TOKENS) : 2200,
      },
      alphaVantageKey: env.ALPHA_VANTAGE_KEY || env.ALPHA_VINTAGE_KEY || undefined,
      serperApiKey: env.SERPER_API_KEY || undefined,
    }
    return this.cached
  }

  /** Human readable list of missing settings, used in logs. */
  static missing(): string[] {
    const c = this.get()
    const missing: string[] = []
    if (!c.nebius.apiKey) missing.push('NEBIUS_API_KEY (required)')
    if (!c.alphaVantageKey) missing.push('ALPHA_VANTAGE_KEY (optional)')
    if (!c.serperApiKey) missing.push('SERPER_API_KEY (optional)')
    return missing
  }
}
