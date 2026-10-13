export { formatLargeNumber } from '@services/utils/helper-functions'

export const money = (n: number | undefined, currency = 'USD') =>
  n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 })

export const num = (n: number | undefined, digits = 2) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits })

export const pct = (n: number | undefined, digits = 1, signed = false) =>
  n === undefined ? '—' : `${signed && n > 0 ? '+' : ''}${n.toFixed(digits)}%`

/** Alpha Vantage ratios such as margins arrive as fractions (0.243 = 24.3%). */
export const fractionPct = (n: number | undefined, digits = 1) => (n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`)

export const duration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

export const timeAgo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}
