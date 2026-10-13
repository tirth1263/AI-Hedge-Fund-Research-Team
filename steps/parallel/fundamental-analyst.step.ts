import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { runSpecialist } from '../../services/utils/specialist-runner'

export const config: EventConfig = {
  type: 'event',
  name: 'FundamentalAnalyst',
  description: 'Performs fundamental analysis: valuation, profitability and growth',
  subscribes: ['parallel-analysis-requested'],
  emits: [{ topic: 'fundamental-analysis-completed', label: 'Fundamental analysis completed' }],
  input: z.object({ query: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['FundamentalAnalyst'] = async (_input, ctx) => {
  await runSpecialist('fundamental', ctx)
}
