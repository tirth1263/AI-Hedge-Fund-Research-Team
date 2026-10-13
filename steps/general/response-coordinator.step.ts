import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { CoordinatedData, FinanceData, WebSearchData } from '../../services/types'
import { StateKeys, StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'ResponseCoordinator',
  description: 'Waits for web search and finance data, then combines them for AI analysis',
  subscribes: ['web-search-completed', 'finance-data-completed'],
  emits: [{ topic: 'response-coordinated', label: 'Data coordinated' }],
  input: z.object({ status: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['ResponseCoordinator'] = async (_input, { emit, logger, state, traceId }) => {
  const store = new StateService(state, traceId)
  const [query, webSearch, financeData] = await Promise.all([
    store.get<string>(StateKeys.query),
    store.get<WebSearchData>(StateKeys.webSearch),
    store.get<FinanceData>(StateKeys.financeData),
  ])

  if (!webSearch || !financeData) {
    logger.info('Waiting for the other data source', { hasWebSearch: !!webSearch, hasFinanceData: !!financeData })
    return
  }
  if (!(await store.acquire(StateKeys.coordinationLock))) {
    logger.info('Data already coordinated for this trace')
    return
  }

  const coordinated: CoordinatedData = {
    query: query ?? financeData.query,
    webSearch,
    financeData,
    timestamp: new Date().toISOString(),
  }
  await store.saveCoordinated(coordinated)

  logger.info('Web search and finance data coordinated', {
    webSearch: webSearch.status,
    financeData: financeData.status,
    symbol: financeData.symbol,
  })
  await emit({ topic: 'response-coordinated', data: { query: coordinated.query } })
}
