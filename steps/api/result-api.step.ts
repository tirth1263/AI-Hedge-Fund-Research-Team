import type { ApiRouteConfig, Handlers } from 'motia'
import { SPECIALISTS, type AnalysisSection, type FinanceData, type WebSearchData } from '../../services/types'
import { StateKeys, StateService } from '../../services/utils/StateService'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'FinanceResultAPI',
  description: 'Retrieves the status and comprehensive report of a financial analysis by traceId',
  path: '/finance-result/:traceId',
  method: 'GET',
  emits: [],
  virtualSubscribes: ['result-saved'],
  virtualEmits: [{ topic: 'result-retrieved', label: 'Result retrieved' }],
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['FinanceResultAPI'] = async (req, { logger, state }) => {
  const { traceId } = req.pathParams
  const store = new StateService(state, traceId)
  const result = await store.getResult()

  if (!result) {
    logger.warn('Result not found', { traceId })
    return { status: 404, body: { error: `No analysis found for traceId ${traceId}` } }
  }

  // Lightweight progress map so clients can render a live pipeline while polling.
  const [webSearch, financeData, general, ...specialists] = await Promise.all([
    store.get<WebSearchData>(StateKeys.webSearch),
    store.get<FinanceData>(StateKeys.financeData),
    store.get<AnalysisSection>(StateKeys.general),
    ...SPECIALISTS.map((t) => store.get<AnalysisSection>(StateKeys.specialist(t))),
  ])

  const progress: Record<string, string> = {
    webSearch: webSearch?.status ?? 'pending',
    financeData: financeData?.status ?? 'pending',
    general: general?.status ?? 'pending',
  }
  SPECIALISTS.forEach((t, i) => (progress[t] = specialists[i]?.status ?? 'pending'))

  logger.info('Result retrieved', { traceId, status: result.status })
  return { status: 200, body: { ...result, progress } }
}
