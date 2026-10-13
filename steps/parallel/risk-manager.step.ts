import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { runSpecialist } from '../../services/utils/specialist-runner'

export const config: EventConfig = {
  type: 'event',
  name: 'RiskManager',
  description: 'Performs risk assessment and downside protection analysis',
  subscribes: ['parallel-analysis-requested'],
  emits: [{ topic: 'risk-analysis-completed', label: 'Risk analysis completed' }],
  input: z.object({ query: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['RiskManager'] = async (_input, ctx) => {
  await runSpecialist('risk', ctx)
}
