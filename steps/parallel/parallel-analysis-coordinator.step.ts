import type { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { SPECIALISTS, type AnalysisSection, type CoordinatedData } from '../../services/types'
import { assembleReport } from '../../services/utils/helper-functions'
import { ServiceFactory } from '../../services/utils/ServiceFactory'
import { StateKeys, StateService } from '../../services/utils/StateService'

export const config: EventConfig = {
  type: 'event',
  name: 'ParallelAnalysisCoordinator',
  description: 'Coordinates all parallel analyses and creates the comprehensive report',
  subscribes: SPECIALISTS.map((t) => `${t}-analysis-completed`),
  emits: [
    { topic: 'comprehensive-report-ready', label: 'Report ready' },
    { topic: 'finance-analysis-error', label: 'Analysis error', conditional: true },
  ],
  input: z.object({ type: z.string(), status: z.string() }),
  flows: ['aihedgefund-workflow'],
}

export const handler: Handlers['ParallelAnalysisCoordinator'] = async (input, { emit, logger, state, traceId }) => {
  const store = new StateService(state, traceId)
  const specialists = await Promise.all(SPECIALISTS.map((t) => store.get<AnalysisSection>(StateKeys.specialist(t))))
  const done = specialists.filter(Boolean).length

  logger.info(`${input.type} analysis reported ${input.status}`, { progress: `${done}/${SPECIALISTS.length}` })
  if (done < SPECIALISTS.length) return
  if (!(await store.acquire(StateKeys.reportLock))) return

  const [data, general] = await Promise.all([
    store.get<CoordinatedData>(StateKeys.coordinated),
    store.get<AnalysisSection>(StateKeys.general),
  ])
  if (!data) {
    await emit({ topic: 'finance-analysis-error', data: { query: '', stage: 'parallel-analysis-coordinator', message: 'Coordinated data missing' } })
    return
  }

  const report = assembleReport(traceId, data, [general, ...specialists])
  if (!report.completedAnalyses.length) {
    await emit({
      topic: 'finance-analysis-error',
      data: {
        query: data.query,
        stage: 'parallel-analysis-coordinator',
        message: specialists.find((s) => s?.error)?.error ?? 'All analyses failed',
      },
    })
    return
  }

  try {
    report.executiveSummary = await ServiceFactory.getNebiusAIService().executiveSummary(report)
  } catch (err) {
    logger.warn('Executive summary failed, report saved without it', { error: (err as Error).message })
  }

  await store.set(StateKeys.report, report)
  logger.info('Comprehensive report created', {
    completed: report.completedAnalyses,
    failed: report.failedAnalyses,
    rating: report.executiveSummary?.rating,
  })
  await emit({ topic: 'comprehensive-report-ready', data: { query: data.query } })
}
