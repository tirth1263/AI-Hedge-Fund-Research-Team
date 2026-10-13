import { FinanceDataService } from '../nebius-ai/FinanceDataService'
import { NebiusAIService } from '../nebius-ai/NebiusAIService'
import { ConfigService } from './ConfigService'
import { WebSearchService } from './WebSearchService'

/** Lazily creates singleton service instances from environment configuration. */
export class ServiceFactory {
  private static nebius?: NebiusAIService
  private static finance?: FinanceDataService
  private static webSearch?: WebSearchService

  static getNebiusAIService(): NebiusAIService {
    this.nebius ??= new NebiusAIService(ConfigService.get().nebius)
    return this.nebius
  }

  static getFinanceDataService(): FinanceDataService {
    this.finance ??= new FinanceDataService(ConfigService.get().alphaVantageKey)
    return this.finance
  }

  static getWebSearchService(): WebSearchService {
    this.webSearch ??= new WebSearchService(ConfigService.get().serperApiKey)
    return this.webSearch
  }
}
