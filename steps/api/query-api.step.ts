import type { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { FinanceResult } from '../../services/types'
import { StateKeys, StateService } from '../../services/utils/StateService'

const bodySchema = z.object({
  query: z.string().trim().min(2, 'Query is too short').max(300, 'Query is too long'),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'FinanceQueryAPI',
  description: 'Accepts stock analysis queries and starts the AI hedge fund research workflow',
  path: '/finance-query',
  method: 'POST',
  emits: [{ topic: 'query-received', label: 'Query received' }],
  virtualSubscribes: ['finance-query-start'],
  flows: ['aihedgefund-workflow'],
  bodySchema,
  responseSchema: {
    200: z.object({
      traceId: z.string(),
      status: z.string(),
      message: z.string(),
      resultUrl: z.string(),
    }),
    400: z.object({ error: z.string() }),
  },
}

export const handler: Handlers['FinanceQueryAPI'] = async (req, { emit, logger, state, traceId }) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    return { status: 400, body: { error: parsed.error.issues.map((i) => i.message).join(', ') } }
  }

  const { query } = parsed.data
  const now = new Date().toISOString()
  logger.info('Finance query received', { query, traceId })

  const store = new StateService(state, traceId)
  await store.set(StateKeys.query, query)
  const initial: FinanceResult = { traceId, status: 'processing', query, createdAt: now, updatedAt: now }
  await store.saveResult(initial)

  await emit({ topic: 'query-received', data: { query, timestamp: now } })

  return {
    status: 200,
    body: {
      traceId,
      status: 'processing',
      message: 'Analysis started. Poll the result URL to retrieve the report.',
      resultUrl: `/finance-result/${traceId}`,
    },
  }
}
