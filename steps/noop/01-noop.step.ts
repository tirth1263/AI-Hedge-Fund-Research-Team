import type { NoopConfig } from 'motia'

/**
 * Result Viewer - a virtual node rendered with a custom React UI
 * (01-noop.step.tsx) that fetches a finished report by traceId.
 */
export const config: NoopConfig = {
  type: 'noop',
  name: 'ResultViewer',
  description: 'View comprehensive analysis results by traceId',
  virtualEmits: [],
  virtualSubscribes: ['view-results', 'result-retrieved'],
  flows: ['aihedgefund-workflow'],
}
