import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { CoordinatedData } from '../../services/types'
import { ServiceFactory } from '../../services/utils/ServiceFactory'
import { StateKeys, StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'NebiusAIAnalysis',
  description: 'Runs the general market analysis with Nebius AI and triggers the parallel specialist analyses',
  subscribes: ['response-coordinated'],
  emits: [
    { topic: 'parallel-analysis-requested', label: 'Parallel analysis requested' },
    { topic: 'finance-analysis-error', label: 'Analysis error', conditional: true },
  ],
  input: z.object({ query: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['NebiusAIAnalysis'] = async (input, { emit, logger, state, traceId }) => {
  const store = new StateService(state, traceId)
  const data = await store.get<CoordinatedData>(StateKeys.coordinated)
  if (!data) {
    logger.error('Coordinated data missing from state')
    await emit({ topic: 'finance-analysis-error', data: { query: input.query, stage: 'nebius-ai-analysis', message: 'Coordinated data missing' } })
    return
  }

  let nebius
  try {
    nebius = ServiceFactory.getNebiusAIService()
  } catch (err) {
    logger.error('Nebius AI is not configured', { error: (err as Error).message })
    await emit({ topic: 'finance-analysis-error', data: { query: input.query, stage: 'nebius-ai-analysis', message: (err as Error).message } })
    return
  }

  logger.info('Running general market analysis', { model: nebius.model })
  const section = await nebius.analyze('general', data)
  await store.set(StateKeys.general, section)

  if (section.status === 'completed') {
    logger.info('General analysis completed', { durationMs: section.durationMs })
  } else {
    // Graceful degradation: the specialists still run on the raw data.
    logger.warn('General analysis failed, specialists will continue without it', { error: section.error })
  }

  await emit({ topic: 'parallel-analysis-requested', data: { query: input.query } })
}
