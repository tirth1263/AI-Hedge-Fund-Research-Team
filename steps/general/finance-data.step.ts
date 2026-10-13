import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ServiceFactory } from '../../services/utils/ServiceFactory'
import { StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'FinanceDataAgent',
  description: 'Retrieves real-time quotes, fundamentals and price history for the queried company',
  subscribes: ['query-received'],
  emits: [{ topic: 'finance-data-completed', label: 'Finance data completed' }],
  input: z.object({ query: z.string(), timestamp: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['FinanceDataAgent'] = async (input, { emit, logger, state, traceId }) => {
  logger.info('Fetching financial data', { query: input.query })

  const data = await ServiceFactory.getFinanceDataService().collect(input.query)
  await new StateService(state, traceId).saveFinanceData(data)

  if (data.status === 'completed') {
    logger.info('Financial data collected', {
      symbol: data.symbol,
      price: data.quote?.price,
      historyPoints: data.history.length,
      warnings: data.warnings,
    })
  } else {
    logger.warn('Financial data unavailable, continuing without it', { status: data.status, error: data.error })
  }

  await emit({ topic: 'finance-data-completed', data: { status: data.status } })
}
