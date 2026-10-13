import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { runSpecialist } from '../../services/utils/specialist-runner'

export const config: EventConfig = {
  type: 'event',
  name: 'TechnicalAnalyst',
  description: 'Performs technical analysis on price action, momentum and key levels',
  subscribes: ['parallel-analysis-requested'],
  emits: [{ topic: 'technical-analysis-completed', label: 'Technical analysis completed' }],
  input: z.object({ query: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['TechnicalAnalyst'] = async (_input, ctx) => {
  await runSpecialist('technical', ctx)
}
