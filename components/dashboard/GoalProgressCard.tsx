import { formatCurrency, formatPercent } from '@/lib/utils'
import type { Goal } from '@/types/database'

interface GoalProgressCardProps {
  title:        string
  period:       'monthly' | 'quarterly' | 'annual'
  goal:         Goal | null
  fycAchieved?: number
  anpAchieved?: number
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ArcProgress({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      {/* Track */}
      <circle
        cx="60" cy="60" r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        className="text-slate-100"
      />
      {/* Fill */}
      <circle
        cx="60" cy="60" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  )
}

const periodColors: Record<string, { stroke: string; text: string; badge: string }> = {
  monthly:   { stroke: '#6366f1', text: 'text-indigo-600',  badge: 'bg-indigo-50 text-indigo-700' },
  quarterly: { stroke: '#8b5cf6', text: 'text-violet-600',  badge: 'bg-violet-50 text-violet-700' },
  annual:    { stroke: '#0ea5e9', text: 'text-sky-600',      badge: 'bg-sky-50 text-sky-700' },
}

export default function GoalProgressCard({ title, period, goal, fycAchieved: fycAchievedProp, anpAchieved: anpAchievedProp }: GoalProgressCardProps) {
  const c = periodColors[period]
  const fycTarget   = goal?.fyc_target ?? 0
  const anpTarget   = goal?.anp_target ?? 0
  const fycAchieved = fycAchievedProp ?? goal?.fyc_achieved ?? 0
  const anpAchieved = anpAchievedProp ?? goal?.anp_achieved ?? 0
  const fycPct = fycTarget > 0 ? (fycAchieved / fycTarget) * 100 : 0
  const anpPct = anpTarget > 0 ? (anpAchieved / anpTarget) * 100 : 0
  const noGoal = !goal

  return (
    <div className="card-hover rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.badge}`}>
          {period}
        </span>
      </div>

      {noGoal ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-sm text-slate-400">No goal set</p>
          <a href="/goals" className="mt-2 text-xs font-medium text-indigo-600 hover:underline">
            Set a goal →
          </a>
        </div>
      ) : (
        <>
          {/* Circular FYC progress */}
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0">
              <ArcProgress pct={fycPct} color={c.stroke} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-bold tabular-nums leading-none ${c.text}`}>
                  {Math.round(fycPct)}%
                </span>
                <span className="text-[9px] text-slate-400 font-medium mt-0.5">FYC</span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {/* FYC */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">FYC</span>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                    {formatCurrency(fycAchieved, true)} / {formatCurrency(fycTarget, true)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(fycPct, 100)}%`, backgroundColor: c.stroke }}
                  />
                </div>
              </div>

              {/* ANP */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">ANP</span>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                    {formatCurrency(anpAchieved, true)} / {formatCurrency(anpTarget, true)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400 transition-all duration-1000"
                    style={{ width: `${Math.min(anpPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer remaining */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Remaining</span>
            <span className="text-sm font-semibold text-slate-700 tabular-nums">
              {formatCurrency(Math.max(fycTarget - fycAchieved, 0))}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
