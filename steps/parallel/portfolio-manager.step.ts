import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { runSpecialist } from '../../services/utils/specialist-runner'

export const config: EventConfig = {
  type: 'event',
  name: 'PortfolioManager',
  description: 'Performs portfolio management analysis: sizing, allocation and diversification',
  subscribes: ['parallel-analysis-requested'],
  emits: [{ topic: 'portfolio-analysis-completed', label: 'Portfolio analysis completed' }],
  input: z.object({ query: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['PortfolioManager'] = async (_input, ctx) => {
  await runSpecialist('portfolio', ctx)
}
