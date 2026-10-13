import type { StepId, StepTrace } from '../engine/workflow'
import { duration } from '../lib/format'

interface NodeDef {
  id: StepId
  label: string
  tag: 'API' | 'EVENT'
  col: number
  row: number
}

/** Same topology as the Motia flow (see docs/architecture), laid out left to right. */
const NODES: NodeDef[] = [
  { id: 'FinanceQueryAPI', label: 'Finance Query API', tag: 'API', col: 0, row: 1.5 },
  { id: 'FinanceDataAgent', label: 'Finance Data Agent', tag: 'EVENT', col: 1, row: 0.75 },
  { id: 'WebSearchAgent', label: 'Web Search Agent', tag: 'EVENT', col: 1, row: 2.25 },
  { id: 'ResponseCoordinator', label: 'Response Coordinator', tag: 'EVENT', col: 2, row: 1.5 },
  { id: 'NebiusAIAnalysis', label: 'Nebius AI Analysis', tag: 'EVENT', col: 3, row: 1.5 },
  { id: 'TechnicalAnalyst', label: 'Technical Analyst', tag: 'EVENT', col: 4, row: 0 },
  { id: 'RiskManager', label: 'Risk Manager', tag: 'EVENT', col: 4, row: 1 },
  { id: 'FundamentalAnalyst', label: 'Fundamental Analyst', tag: 'EVENT', col: 4, row: 2 },
  { id: 'PortfolioManager', label: 'Portfolio Manager', tag: 'EVENT', col: 4, row: 3 },
  { id: 'ParallelAnalysisCoordinator', label: 'Analysis Coordinator', tag: 'EVENT', col: 5, row: 1.5 },
  { id: 'SaveResult', label: 'Save Result', tag: 'EVENT', col: 6, row: 1.5 },
  { id: 'FinanceResultAPI', label: 'Finance Result API', tag: 'API', col: 7, row: 1.5 },
]

const EDGES: [StepId, StepId][] = [
  ['FinanceQueryAPI', 'FinanceDataAgent'],
  ['FinanceQueryAPI', 'WebSearchAgent'],
  ['FinanceDataAgent', 'ResponseCoordinator'],
  ['WebSearchAgent', 'ResponseCoordinator'],
  ['ResponseCoordinator', 'NebiusAIAnalysis'],
  ['NebiusAIAnalysis', 'TechnicalAnalyst'],
  ['NebiusAIAnalysis', 'RiskManager'],
  ['NebiusAIAnalysis', 'FundamentalAnalyst'],
  ['NebiusAIAnalysis', 'PortfolioManager'],
  ['TechnicalAnalyst', 'ParallelAnalysisCoordinator'],
  ['RiskManager', 'ParallelAnalysisCoordinator'],
  ['FundamentalAnalyst', 'ParallelAnalysisCoordinator'],
  ['PortfolioManager', 'ParallelAnalysisCoordinator'],
  ['ParallelAnalysisCoordinator', 'SaveResult'],
  ['SaveResult', 'FinanceResultAPI'],
]

const W = 150
const H = 50
const COL = 178
const ROW = 64
const PAD_X = 10
const PAD_Y = 12

const pos = (n: NodeDef) => ({ x: PAD_X + n.col * COL, y: PAD_Y + n.row * ROW })
const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<StepId, NodeDef>

export function WorkflowGraph({ traces }: { traces: Partial<Record<StepId, StepTrace>> }) {
  const width = PAD_X * 2 + 7 * COL + W
  const height = PAD_Y * 2 + 3 * ROW + H

  return (
    <div className="graph-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Multi-agent workflow graph">
        {EDGES.map(([from, to]) => {
          const a = pos(byId[from])
          const b = pos(byId[to])
          const x1 = a.x + W
          const y1 = a.y + H / 2
          const x2 = b.x
          const y2 = b.y + H / 2
          const mid = (x1 + x2) / 2
          const src = traces[from]?.state
          const dst = traces[to]?.state
          const cls = dst === 'running' && src && src !== 'running' ? 'active' : dst && dst !== 'idle' && dst !== 'running' ? 'done' : ''
          return <path key={`${from}-${to}`} className={`g-edge ${cls}`} d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`} />
        })}
        {NODES.map((n) => {
          const { x, y } = pos(n)
          const tr = traces[n.id]
          const state = tr?.state ?? 'idle'
          const elapsed = tr?.start && tr.end ? duration(tr.end - tr.start) : state === 'running' ? 'running…' : ''
          return (
            <g key={n.id} className={`g-node ${state}`} transform={`translate(${x},${y})`}>
              <title>{`${n.id}: ${state}${tr?.note ? ` (${tr.note})` : ''}`}</title>
              <rect className="box" width={W} height={H} rx={10} />
              <text x={12} y={17} className="tag">
                {n.tag}
              </text>
              <text x={W - 12} y={17} className="time" textAnchor="end">
                {elapsed}
              </text>
              <text x={12} y={36} fontSize={12.5} fontWeight={600}>
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
