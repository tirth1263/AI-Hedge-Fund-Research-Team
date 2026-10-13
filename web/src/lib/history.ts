import type { FinanceResult } from '@services/types'

const KEY = 'ahf.history'
const LIMIT = 12

export function loadHistory(): FinanceResult[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as FinanceResult[]
  } catch {
    return []
  }
}

export function addToHistory(result: FinanceResult): FinanceResult[] {
  const next = [result, ...loadHistory().filter((r) => r.traceId !== result.traceId)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: history is a convenience only */
  }
  return next
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
