'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface PipelineStageData {
  stage: string
  stageKey: string
  count: number
  fyc: number
  anp: number
}

const STAGE_COLORS: Record<string, string> = {
  new_lead:        '#818cf8',
  contacted:       '#60a5fa',
  appointment_set: '#22d3ee',
  fact_find:       '#a78bfa',
  proposal:        '#f59e0b',
  closing:         '#f97316',
}

interface PipelineChartProps {
  data: PipelineStageData[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as PipelineStageData
  return (
    <div className="rounded-xl bg-slate-900 px-4 py-3 shadow-xl text-xs space-y-1.5 border border-slate-700">
      <p className="font-semibold text-white">{label}</p>
      <p className="text-slate-300">Opportunities: <span className="text-white font-medium">{d.count}</span></p>
      <p className="text-slate-300">Est. FYC: <span className="text-indigo-300 font-medium">{formatCurrency(d.fyc)}</span></p>
      <p className="text-slate-300">Est. ANP: <span className="text-violet-300 font-medium">{formatCurrency(d.anp)}</span></p>
    </div>
  )
}

export default function PipelineChart({ data }: PipelineChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const totalFYC = data.reduce((s, d) => s + d.fyc, 0)

  const isEmpty = total === 0

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm h-full">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Pipeline by Stage</h3>
          <p className="text-xs text-slate-400 mt-0.5">Open opportunities breakdown</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 leading-none">Total FYC</p>
          <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">{formatCurrency(totalFYC)}</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">No open opportunities</p>
          <a href="/pipeline" className="mt-2 text-xs font-medium text-indigo-600 hover:underline">Add your first →</a>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'inherit' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.map(entry => (
                  <Cell key={entry.stageKey} fill={STAGE_COLORS[entry.stageKey] ?? '#818cf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {data.map(d => (
              <div key={d.stageKey} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: STAGE_COLORS[d.stageKey] ?? '#818cf8' }}
                />
                <span className="text-xs text-slate-500 truncate">{d.stage}</span>
                <span className="ml-auto text-xs font-medium text-slate-700">{d.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
