import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ServiceFactory } from '../../services/utils/ServiceFactory'
import { StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'WebSearchAgent',
  description: 'Searches the web and news for information related to the financial query',
  subscribes: ['query-received'],
  emits: [{ topic: 'web-search-completed', label: 'Web search completed' }],
  input: z.object({ query: z.string(), timestamp: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['WebSearchAgent'] = async (input, { emit, logger, state, traceId }) => {
  logger.info('Starting web search', { query: input.query })

  const result = await ServiceFactory.getWebSearchService().search(input.query)
  await new StateService(state, traceId).saveWebSearch(result)

  if (result.status === 'completed') {
    logger.info('Web search completed', { results: result.results.length, news: result.news.length })
  } else {
    logger.warn('Web search degraded, continuing without it', { status: result.status, error: result.error })
  }

  await emit({ topic: 'web-search-completed', data: { status: result.status } })
}
