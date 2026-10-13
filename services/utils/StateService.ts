import type { InternalStateManager } from 'motia'
import type { AnalysisSection, CoordinatedData, FinanceData, FinanceResult, SpecialistType, WebSearchData } from '../types'

/** Global group that indexes every result by traceId (second access pattern). */
export const RESULTS_GROUP = 'finance-results'

export const StateKeys = {
  query: 'query',
  webSearch: 'webSearch',
  financeData: 'financeData',
  coordinated: 'coordinatedData',
  coordinationLock: 'coordinationLock',
  general: 'analysis:general',
  specialist: (type: SpecialistType) => `analysis:${type}`,
  reportLock: 'reportLock',
  report: 'comprehensiveReport',
  result: 'result',
} as const

/**
 * Typed wrapper around Motia state. Workflow data lives in a group named after
 * the traceId so every run is isolated; final results are also mirrored into
 * the global `finance-results` group for lookup by id.
 */
export class StateService {
  constructor(
    private readonly state: InternalStateManager,
    private readonly traceId: string,
  ) {}

  get<T>(key: string) {
    return this.state.get<T>(this.traceId, key)
  }

  set<T>(key: string, value: T) {
    return this.state.set<T>(this.traceId, key, value)
  }

  saveWebSearch(data: WebSearchData) {
    return this.set(StateKeys.webSearch, data)
  }

  saveFinanceData(data: FinanceData) {
    return this.set(StateKeys.financeData, data)
  }

  saveCoordinated(data: CoordinatedData) {
    return this.set(StateKeys.coordinated, data)
  }

  saveSpecialist(type: SpecialistType, section: AnalysisSection) {
    return this.set(StateKeys.specialist(type), section)
  }

  /** Best-effort lock so fan-in steps only continue once per trace. */
  async acquire(lockKey: string): Promise<boolean> {
    if (await this.get<boolean>(lockKey)) return false
    await this.set(lockKey, true)
    return true
  }

  async saveResult(result: FinanceResult) {
    await this.set(StateKeys.result, result)
    await this.state.set(RESULTS_GROUP, this.traceId, result)
  }

  async getResult(): Promise<FinanceResult | null> {
    return (await this.get<FinanceResult>(StateKeys.result)) ?? (await this.state.get<FinanceResult>(RESULTS_GROUP, this.traceId))
  }
}
