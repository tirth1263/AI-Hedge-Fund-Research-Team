import type { FlowContext } from 'motia'
import type { AnalysisSection, CoordinatedData, SpecialistType } from '../types'
import { AGENTS } from '../nebius-ai/NebiusAIService'
import { ServiceFactory } from './ServiceFactory'
import { StateKeys, StateService } from './StateService'

/**
 * Shared body of the four parallel specialist agents: load the coordinated data
 * and the Head of Research brief from state, run the agent, persist the section
 * and announce completion (even on failure, so the coordinator never waits forever).
 */
export async function runSpecialist(type: SpecialistType, ctx: FlowContext<any>): Promise<void> {
  const { emit, logger, state, traceId } = ctx
  const store = new StateService(state, traceId)
  const topic = `${type}-analysis-completed`

  const [data, general] = await Promise.all([
    store.get<CoordinatedData>(StateKeys.coordinated),
    store.get<AnalysisSection>(StateKeys.general),
  ])

  let section: AnalysisSection
  if (!data) {
    section = {
      type,
      title: AGENTS[type].title,
      status: 'failed',
      summary: 'Analysis failed',
      details: '',
      error: 'Coordinated data missing from state',
      timestamp: new Date().toISOString(),
    }
  } else {
    logger.info(`Starting ${type} analysis`)
    section = await ServiceFactory.getNebiusAIService().analyze(type, data, {
      generalContext: general?.status === 'completed' ? general.details : undefined,
    })
  }

  await store.saveSpecialist(type, section)
  if (section.status === 'completed') logger.info(`${type} analysis completed`, { durationMs: section.durationMs })
  else logger.error(`${type} analysis failed`, { error: section.error })

  await emit({ topic, data: { type, status: section.status } })
}
