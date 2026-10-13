import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { ComprehensiveReport, FinanceResult } from '../../services/types'
import { StateKeys, StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'SaveResult',
  description: 'Saves the comprehensive report (or a failure) to state for UI and API access',
  subscribes: ['comprehensive-report-ready', 'finance-analysis-error'],
  emits: [],
  virtualEmits: [{ topic: 'result-saved', label: 'Result saved' }],
  input: z.object({
    query: z.string(),
    stage: z.string().optional(),
    message: z.string().optional(),
  }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['SaveResult'] = async (input, { logger, state, traceId }) => {
  const store = new StateService(state, traceId)
  const previous = await store.getResult()
  const report = await store.get<ComprehensiveReport>(StateKeys.report)
  const now = new Date().toISOString()

  const result: FinanceResult = input.message
    ? {
        traceId,
        status: 'failed',
        query: input.query || previous?.query || '',
        error: `${input.stage ?? 'workflow'}: ${input.message}`,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }
    : {
        traceId,
        status: report ? 'completed' : 'failed',
        query: input.query || previous?.query || '',
        comprehensiveReport: report ?? undefined,
        error: report ? undefined : 'Report missing from state',
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }

  // Stored per-trace and in the global results index (multiple access patterns).
  await store.saveResult(result)

  logger.info('Result saved', { status: result.status, error: result.error })
}
