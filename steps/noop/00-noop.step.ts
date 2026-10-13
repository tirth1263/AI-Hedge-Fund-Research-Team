import type { NoopConfig } from 'motia'

/**
 * Finance Query Starter - a virtual node rendered with a custom React UI
 * (00-noop.step.tsx) that lets you start an analysis from the Motia Workbench.
 */
export const config: NoopConfig = {
  type: 'noop',
  name: 'FinanceQueryStarter',
  description: 'Enter a stock symbol or company name to analyze',
  virtualEmits: [
    { topic: 'finance-query-start', label: 'Query started' },
    { topic: 'view-results', label: 'View results' },
  ],
  virtualSubscribes: [],
  flows: ['aihedgefund-workflow'],
}
