'use client'

import { useState, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import {
  Target, Edit2, TrendingUp, TrendingDown, Minus, X,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import type { Goal, Opportunity, PeriodType } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalsPageProps {
  goals:    Goal[]
  wonOpps:  Opportunity[]
  openOpps: Opportunity[]
  userId:   string
}

interface PeriodBounds { start: Date; end: Date }

interface PeriodMetrics {
  fycAchieved:     number
  anpAchieved:     number
  fycTarget:       number
  anpTarget:       number
  fycGap:          number
  anpGap:          number
  fycPct:          number
  anpPct:          number
  fycProjected:    number
  anpProjected:    number
  fycProjPct:      number
  anpProjPct:      number
  fycReqWeekly:    number
  anpReqWeekly:    number
  fycReqMonthly:   number
  anpReqMonthly:   number
  fycPaceAmount:   number
  anpPaceAmount:   number
  weeksRemaining:  number
  monthsRemaining: number
  daysRemaining:   number
  pctPeriodElapsed: number
  pipelineOpps:    Opportunity[]
  wonCount:        number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const OPEN_STAGE_LABELS: Record<string, string> = {
  new_lead:        'New Lead',
  contacted:       'Contacted',
  appointment_set: 'Appt. Set',
  fact_find:       'Fact Find',
  proposal:        'Proposal',
  closing:         'Closing',
}

const OPEN_STAGE_ORDER = [
  'new_lead', 'contacted', 'appointment_set', 'fact_find', 'proposal', 'closing',
]

function getPeriodBounds(
  type: PeriodType, year: number, month?: number, quarter?: number,
): PeriodBounds {
  if (type === 'monthly') {
    return {
      start: new Date(year, month! - 1, 1),
      end:   new Date(year, month!, 0, 23, 59, 59),
    }
  }
  if (type === 'quarterly') {
    const startMonth = (quarter! - 1) * 3
    return {
      start: new Date(year, startMonth, 1),
      end:   new Date(year, startMonth + 3, 0, 23, 59, 59),
    }
  }
  return {
    start: new Date(year, 0, 1),
    end:   new Date(year, 11, 31, 23, 59, 59),
  }
}

function findGoal(
  goals: Goal[], type: PeriodType, year: number, month?: number, quarter?: number,
): Goal | null {
  return goals.find(g =>
    g.period_type === type &&
    g.period_year === year &&
    (type === 'monthly'   ? g.period_month   === month   : true) &&
    (type === 'quarterly' ? g.period_quarter === quarter : true)
  ) ?? null
}

function computeMetrics(
  goal: Goal | null,
  wonOpps: Opportunity[],
  openOpps: Opportunity[],
  bounds: PeriodBounds,
): PeriodMetrics {
  const today = new Date()
  const { start, end } = bounds

  const inPeriod = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= start && d <= end
  }

  const wonInPeriod  = wonOpps.filter(o => inPeriod(o.expected_close_date))
  const pipelineOpps = openOpps.filter(o => inPeriod(o.expected_close_date))

  const fycAchieved = wonInPeriod.reduce((s, o)  => s + (o.estimated_fyc ?? 0), 0)
  const anpAchieved = wonInPeriod.reduce((s, o)  => s + (o.estimated_anp ?? 0), 0)
  const fycWeighted = pipelineOpps.reduce((s, o) => s + (o.estimated_fyc ?? 0) * (o.probability / 100), 0)
  const anpWeighted = pipelineOpps.reduce((s, o) => s + (o.estimated_anp ?? 0) * (o.probability / 100), 0)

  const fycProjected = fycAchieved + fycWeighted
  const anpProjected = anpAchieved + anpWeighted

  const periodMs     = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs    = Math.max(0, Math.min(periodMs, today.getTime() - start.getTime()))
  const remainingMs  = Math.max(0, end.getTime() - today.getTime())
  const pctPeriodElapsed = elapsedMs / periodMs
  const daysRemaining    = remainingMs / 86400000
  const weeksRemaining   = daysRemaining / 7
  const monthsRemaining  = daysRemaining / 30.44

  const fycTarget = goal?.fyc_target ?? 0
  const anpTarget = goal?.anp_target ?? 0
  const fycGap    = Math.max(0, fycTarget - fycAchieved)
  const anpGap    = Math.max(0, anpTarget - anpAchieved)
  const fycPct    = fycTarget > 0 ? (fycAchieved / fycTarget) * 100 : 0
  const anpPct    = anpTarget > 0 ? (anpAchieved / anpTarget) * 100 : 0
  const fycProjPct = fycTarget > 0 ? (fycProjected / fycTarget) * 100 : 0
  const anpProjPct = anpTarget > 0 ? (anpProjected / anpTarget) * 100 : 0

  const fycReqWeekly  = weeksRemaining  > 0.1 ? fycGap / weeksRemaining  : fycGap
  const anpReqWeekly  = weeksRemaining  > 0.1 ? anpGap / weeksRemaining  : anpGap
  const fycReqMonthly = monthsRemaining > 0.1 ? fycGap / monthsRemaining : fycGap
  const anpReqMonthly = monthsRemaining > 0.1 ? anpGap / monthsRemaining : anpGap

  const fycPaceAmount = fycTarget * (fycPct / 100 - pctPeriodElapsed)
  const anpPaceAmount = anpTarget * (anpPct / 100 - pctPeriodElapsed)

  return {
    fycAchieved, anpAchieved,
    fycTarget, anpTarget,
    fycGap, anpGap,
    fycPct, anpPct,
    fycProjected, anpProjected,
    fycProjPct, anpProjPct,
    fycReqWeekly, anpReqWeekly,
    fycReqMonthly, anpReqMonthly,
    fycPaceAmount, anpPaceAmount,
    weeksRemaining, monthsRemaining, daysRemaining,
    pctPeriodElapsed,
    pipelineOpps,
    wonCount: wonInPeriod.length,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RADIUS = 52
const CIRC   = 2 * Math.PI * RADIUS

function ArcRing({
  pct, projPct, stroke, projStroke,
}: { pct: number; projPct: number; stroke: string; projStroke: string }) {
  const achieved  = Math.min(Math.max(pct,     0), 100)
  const projected = Math.min(Math.max(projPct, 0), 100)
  const achievedOffset  = CIRC * (1 - achieved  / 100)
  const projectedOffset = CIRC * (1 - projected / 100)

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      {/* Track */}
      <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      {/* Projected (faint) */}
      {projPct > pct && (
        <circle
          cx="60" cy="60" r={RADIUS} fill="none"
          stroke={projStroke} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={projectedOffset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          opacity={0.25}
        />
      )}
      {/* Achieved */}
      <circle
        cx="60" cy="60" r={RADIUS} fill="none"
        stroke={stroke} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={CIRC} strokeDashoffset={achievedOffset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

function PaceChip({ amount, target }: { amount: number; target: number }) {
  if (target === 0) return null
  const ahead = amount > 0
  const behind = amount < 0
  const neutral = !ahead && !behind
  const abs = Math.abs(amount)

  if (neutral) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        <Minus className="h-3 w-3" /> On pace
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      ahead ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {ahead
        ? <><TrendingUp className="h-3 w-3" />{formatCurrency(abs, true)} ahead</>
        : <><TrendingDown className="h-3 w-3" />{formatCurrency(abs, true)} behind</>
      }
    </span>
  )
}

interface GoalCardProps {
  label:       'FYC' | 'ANP'
  achieved:    number
  target:      number
  gap:         number
  pct:         number
  projected:   number
  projPct:     number
  reqWeekly:   number
  reqMonthly:  number
  paceAmount:  number
  periodType:  PeriodType
  daysRemaining: number
  hasGoal:     boolean
  onEdit:      () => void
}

function GoalCard({
  label, achieved, target, gap, pct, projected, projPct,
  reqWeekly, reqMonthly, paceAmount, periodType, daysRemaining, hasGoal, onEdit,
}: GoalCardProps) {
  const isFYC = label === 'FYC'
  const stroke     = isFYC ? '#6366f1' : '#8b5cf6'
  const projStroke = isFYC ? '#6366f1' : '#8b5cf6'
  const textColor  = isFYC ? 'text-indigo-600' : 'text-violet-600'
  const barColor   = isFYC ? 'bg-indigo-500'   : 'bg-violet-500'
  const projColor  = isFYC ? 'bg-indigo-200'   : 'bg-violet-200'

  const pctClamped    = Math.min(pct,     100)
  const projClamped   = Math.min(projPct, 100)
  const isComplete    = pct >= 100
  const isOverProject = projPct >= 100

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${textColor}`}>{label}</span>
          <span className="text-xs text-slate-400 font-medium">Goal</span>
          {isComplete && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Edit2 className="h-3 w-3" />
          {hasGoal ? 'Edit' : 'Set Goal'}
        </button>
      </div>

      {!hasGoal ? (
        <div className="px-5 pb-6 pt-2 flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Target className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No {label} goal set for this period</p>
          <button
            onClick={onEdit}
            className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Set a goal →
          </button>
        </div>
      ) : (
        <div className="px-5 pb-5 space-y-4">
          {/* Arc + central stats */}
          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0">
              <ArcRing pct={pctClamped} projPct={projClamped} stroke={stroke} projStroke={projStroke} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-bold tabular-nums leading-none ${textColor}`}>
                  {Math.round(pct)}%
                </span>
                <span className="text-[9px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">{label}</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              {/* Achieved / Target */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Achieved</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(achieved)}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Target</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(target)}</span>
                </div>
                {/* Stacked progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className={`h-full rounded-l-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pctClamped}%` }}
                  />
                  {projClamped > pctClamped && (
                    <div
                      className={`h-full transition-all duration-700 ${projColor}`}
                      style={{ width: `${Math.min(projClamped - pctClamped, 100 - pctClamped)}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] mt-1 text-slate-400">
                  <span>Achieved</span>
                  {projClamped > pctClamped && <span className="text-slate-300">Projected</span>}
                </div>
              </div>

              {/* Pace */}
              <PaceChip amount={paceAmount} target={target} />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Gap */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Gap Remaining</p>
              <p className={`text-sm font-bold tabular-nums ${gap === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                {gap === 0 ? 'Complete!' : formatCurrency(gap)}
              </p>
            </div>

            {/* Projected */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Projected Total</p>
              <p className={`text-sm font-bold tabular-nums ${isOverProject ? 'text-emerald-600' : 'text-slate-800'}`}>
                {formatCurrency(projected)}
                {isOverProject && <span className="ml-1 text-[10px] font-semibold text-emerald-500">✓</span>}
              </p>
            </div>

            {/* Required weekly */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Req. / Week</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">
                {daysRemaining < 1 ? '—' : formatCurrency(reqWeekly, true)}
              </p>
            </div>

            {/* Required monthly — hide for monthly goals */}
            {periodType !== 'monthly' && (
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Req. / Month</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">
                  {daysRemaining < 1 ? '—' : formatCurrency(reqMonthly, true)}
                </p>
              </div>
            )}

            {/* Days remaining */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Days Left</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">
                {daysRemaining < 1 ? 'Ended' : `${Math.ceil(daysRemaining)}d`}
              </p>
            </div>

            {/* Projection % */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Proj. Achievement</p>
              <p className={`text-sm font-bold tabular-nums ${projPct >= 100 ? 'text-emerald-600' : projPct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                {Math.round(projPct)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pipeline Table ───────────────────────────────────────────────────────────

function PipelineTable({ opps, periodLabel }: { opps: Opportunity[]; periodLabel: string }) {
  const byStage = useMemo(() => {
    const acc: Record<string, { count: number; fyc: number; anp: number; weightedFyc: number; weightedAnp: number }> = {}
    OPEN_STAGE_ORDER.forEach(s => { acc[s] = { count: 0, fyc: 0, anp: 0, weightedFyc: 0, weightedAnp: 0 } })
    for (const o of opps) {
      if (!acc[o.stage]) continue
      acc[o.stage].count++
      acc[o.stage].fyc += o.estimated_fyc ?? 0
      acc[o.stage].anp += o.estimated_anp ?? 0
      acc[o.stage].weightedFyc += (o.estimated_fyc ?? 0) * (o.probability / 100)
      acc[o.stage].weightedAnp += (o.estimated_anp ?? 0) * (o.probability / 100)
    }
    return OPEN_STAGE_ORDER
      .filter(s => acc[s].count > 0)
      .map(s => ({ stage: s, ...acc[s] }))
  }, [opps])

  const totals = useMemo(() => byStage.reduce((t, r) => ({
    count:       t.count       + r.count,
    fyc:         t.fyc         + r.fyc,
    anp:         t.anp         + r.anp,
    weightedFyc: t.weightedFyc + r.weightedFyc,
    weightedAnp: t.weightedAnp + r.weightedAnp,
  }), { count: 0, fyc: 0, anp: 0, weightedFyc: 0, weightedAnp: 0 }), [byStage])

  if (byStage.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Pipeline Projection</h3>
        <p className="text-xs text-slate-400">
          No open opportunities with close dates in {periodLabel}.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Pipeline Projection</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Open opportunities closing in {periodLabel} — probability-weighted
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
          {totals.count} opp{totals.count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stage</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Opps</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. FYC</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weighted FYC</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. ANP</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weighted ANP</th>
            </tr>
          </thead>
          <tbody>
            {byStage.map(row => (
              <tr key={row.stage} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">
                  {OPEN_STAGE_LABELS[row.stage] ?? row.stage}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{row.count}</td>
                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{formatCurrency(row.fyc)}</td>
                <td className="px-4 py-3 text-right font-semibold text-indigo-600 tabular-nums">{formatCurrency(row.weightedFyc)}</td>
                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{formatCurrency(row.anp)}</td>
                <td className="px-4 py-3 text-right font-semibold text-violet-600 tabular-nums">{formatCurrency(row.weightedAnp)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wide">Total</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">{totals.count}</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">{formatCurrency(totals.fyc)}</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">{formatCurrency(totals.weightedFyc)}</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 tabular-nums">{formatCurrency(totals.anp)}</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-violet-700 tabular-nums">{formatCurrency(totals.weightedAnp)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Set Goal Modal ───────────────────────────────────────────────────────────

const goalSchema = z.object({
  fyc_target: z.string().optional().or(z.literal('')),
  anp_target: z.string().optional().or(z.literal('')),
})
type GoalFormData = z.infer<typeof goalSchema>

interface SetGoalModalProps {
  periodLabel: string
  periodType:  PeriodType
  year:        number
  month?:      number
  quarter?:    number
  existing:    Goal | null
  userId:      string
  onSaved:     (goal: Goal) => void
  onClose:     () => void
}

function SetGoalModal({
  periodLabel, periodType, year, month, quarter, existing, userId, onSaved, onClose,
}: SetGoalModalProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      fyc_target: existing?.fyc_target != null ? String(existing.fyc_target) : '0',
      anp_target: existing?.anp_target != null ? String(existing.anp_target) : '0',
    },
  })

  const onSubmit = useCallback(async (data: GoalFormData) => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient() as any
      const fycTarget = parseFloat(data.fyc_target || '0') || 0
      const anpTarget = parseFloat(data.anp_target || '0') || 0
      const record = {
        user_id:    userId,
        period_type: periodType,
        period_year: year,
        fyc_target:  fycTarget,
        anp_target:  anpTarget,
        fyc_achieved: existing?.fyc_achieved ?? 0,
        anp_achieved: existing?.anp_achieved ?? 0,
        ...(periodType === 'monthly'   ? { period_month:   month,   period_quarter: null } : {}),
        ...(periodType === 'quarterly' ? { period_quarter: quarter, period_month:   null } : {}),
        ...(periodType === 'annual'    ? { period_month:   null,    period_quarter: null } : {}),
      }

      const { data: saved, error: dbErr } = existing
        ? await supabase.from('goals').update(record).eq('id', existing.id).select().single()
        : await supabase.from('goals').insert(record).select().single()

      if (dbErr) throw dbErr
      onSaved(saved as Goal)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save goal')
    } finally {
      setSaving(false)
    }
  }, [userId, periodType, year, month, quarter, existing, onSaved])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200/80">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {existing ? 'Edit Goal' : 'Set Goal'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{periodLabel}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              FYC Target (First Year Commission)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">$</span>
              <input
                {...register('fyc_target')}
                type="number" min="0" step="100"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ANP Target (Annual New Premium)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">$</span>
              <input
                {...register('anp_target')}
                type="number" min="0" step="100"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Summary Banner ───────────────────────────────────────────────────────────

function SummaryBanner({ metrics, periodType }: { metrics: PeriodMetrics; periodType: PeriodType }) {
  const cards = [
    {
      label: 'FYC Achieved',
      value: formatCurrency(metrics.fycAchieved),
      sub:   `${Math.round(metrics.fycPct)}% of target`,
      color: 'text-indigo-700',
      bg:    'bg-indigo-50 border-indigo-100',
    },
    {
      label: 'FYC Projected',
      value: formatCurrency(metrics.fycProjected),
      sub:   `${Math.round(metrics.fycProjPct)}% of target`,
      color: metrics.fycProjPct >= 100 ? 'text-emerald-700' : 'text-slate-700',
      bg:    metrics.fycProjPct >= 100 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200',
    },
    {
      label: 'ANP Achieved',
      value: formatCurrency(metrics.anpAchieved),
      sub:   `${Math.round(metrics.anpPct)}% of target`,
      color: 'text-violet-700',
      bg:    'bg-violet-50 border-violet-100',
    },
    {
      label: 'ANP Projected',
      value: formatCurrency(metrics.anpProjected),
      sub:   `${Math.round(metrics.anpProjPct)}% of target`,
      color: metrics.anpProjPct >= 100 ? 'text-emerald-700' : 'text-slate-700',
      bg:    metrics.anpProjPct >= 100 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200',
    },
    {
      label: 'Won Deals',
      value: `${metrics.wonCount}`,
      sub:   'in this period',
      color: 'text-slate-700',
      bg:    'bg-white border-slate-200',
    },
    {
      label: 'Pipeline Opps',
      value: `${metrics.pipelineOpps.length}`,
      sub:   'open with close date',
      color: 'text-slate-700',
      bg:    'bg-white border-slate-200',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.bg}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className={`text-base font-bold tabular-nums mt-0.5 ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoalsPage({ goals: initialGoals, wonOpps, openOpps, userId }: GoalsPageProps) {
  const now  = new Date()
  const year = now.getFullYear()

  const [goals,           setGoals]           = useState<Goal[]>(initialGoals)
  const [periodTab,       setPeriodTab]        = useState<PeriodType>('monthly')
  const [selectedMonth,   setSelectedMonth]    = useState(now.getMonth() + 1)
  const [selectedQuarter, setSelectedQuarter]  = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [modalOpen,       setModalOpen]        = useState(false)
  const [editingLabel,    setEditingLabel]     = useState<'FYC' | 'ANP' | null>(null)

  // Derived period params
  const { month, quarter } = useMemo(() => ({
    month:   periodTab === 'monthly'   ? selectedMonth   : undefined,
    quarter: periodTab === 'quarterly' ? selectedQuarter : undefined,
  }), [periodTab, selectedMonth, selectedQuarter])

  // Current goal record
  const currentGoal = useMemo(
    () => findGoal(goals, periodTab, year, month, quarter),
    [goals, periodTab, year, month, quarter],
  )

  // Period bounds and metrics
  const bounds  = useMemo(() => getPeriodBounds(periodTab, year, month, quarter), [periodTab, year, month, quarter])
  const metrics = useMemo(() => computeMetrics(currentGoal, wonOpps, openOpps, bounds), [currentGoal, wonOpps, openOpps, bounds])

  // Period label for display
  const periodLabel = useMemo(() => {
    if (periodTab === 'monthly')   return `${MONTH_NAMES[selectedMonth - 1]} ${year}`
    if (periodTab === 'quarterly') return `Q${selectedQuarter} ${year}`
    return `Annual ${year}`
  }, [periodTab, selectedMonth, selectedQuarter, year])

  const handleGoalSaved = useCallback((saved: Goal) => {
    setGoals(prev => {
      const idx = prev.findIndex(g => g.id === saved.id)
      return idx >= 0 ? prev.map((g, i) => i === idx ? saved : g) : [...prev, saved]
    })
    setModalOpen(false)
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Goals</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track FYC &amp; ANP targets across all periods · {year}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Target className="h-4 w-4" />
          {currentGoal ? 'Edit Goal' : 'Set Goal'}
        </button>
      </div>

      {/* ── Period tabs ───────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['monthly', 'quarterly', 'annual'] as PeriodType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setPeriodTab(tab)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
              periodTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Period selector ───────────────────────────── */}
      {periodTab === 'monthly' && (
        <div className="flex flex-wrap gap-1.5">
          {MONTH_NAMES.map((m, i) => {
            const num       = i + 1
            const isCurrent = num === (now.getMonth() + 1)
            const hasGoal   = goals.some(g => g.period_type === 'monthly' && g.period_month === num)
            return (
              <button
                key={m}
                onClick={() => setSelectedMonth(num)}
                className={`relative rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedMonth === num
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {m}
                {hasGoal && (
                  <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${selectedMonth === num ? 'bg-indigo-300' : 'bg-indigo-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {periodTab === 'quarterly' && (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(q => {
            const isCurrent = q === Math.ceil((now.getMonth() + 1) / 3)
            const hasGoal   = goals.some(g => g.period_type === 'quarterly' && g.period_quarter === q)
            return (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`relative rounded-lg px-5 py-1.5 text-xs font-semibold transition-all ${
                  selectedQuarter === q
                    ? 'bg-violet-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                Q{q}
                {hasGoal && (
                  <span className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${selectedQuarter === q ? 'bg-violet-300' : 'bg-violet-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Summary banner ────────────────────────────── */}
      <SummaryBanner metrics={metrics} periodType={periodTab} />

      {/* ── Goal cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GoalCard
          label="FYC"
          achieved={metrics.fycAchieved}
          target={metrics.fycTarget}
          gap={metrics.fycGap}
          pct={metrics.fycPct}
          projected={metrics.fycProjected}
          projPct={metrics.fycProjPct}
          reqWeekly={metrics.fycReqWeekly}
          reqMonthly={metrics.fycReqMonthly}
          paceAmount={metrics.fycPaceAmount}
          periodType={periodTab}
          daysRemaining={metrics.daysRemaining}
          hasGoal={!!currentGoal}
          onEdit={() => setModalOpen(true)}
        />
        <GoalCard
          label="ANP"
          achieved={metrics.anpAchieved}
          target={metrics.anpTarget}
          gap={metrics.anpGap}
          pct={metrics.anpPct}
          projected={metrics.anpProjected}
          projPct={metrics.anpProjPct}
          reqWeekly={metrics.anpReqWeekly}
          reqMonthly={metrics.anpReqMonthly}
          paceAmount={metrics.anpPaceAmount}
          periodType={periodTab}
          daysRemaining={metrics.daysRemaining}
          hasGoal={!!currentGoal}
          onEdit={() => setModalOpen(true)}
        />
      </div>

      {/* ── Pipeline projection table ─────────────────── */}
      <PipelineTable opps={metrics.pipelineOpps} periodLabel={periodLabel} />

      {/* ── All goals overview ────────────────────────── */}
      <AllGoalsOverview goals={goals} year={year} onEdit={() => setModalOpen(true)} />

      {/* ── Modal ─────────────────────────────────────── */}
      {modalOpen && (
        <SetGoalModal
          periodLabel={periodLabel}
          periodType={periodTab}
          year={year}
          month={month}
          quarter={quarter}
          existing={currentGoal}
          userId={userId}
          onSaved={handleGoalSaved}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

// ─── All Goals Overview ───────────────────────────────────────────────────────

function AllGoalsOverview({ goals, year, onEdit }: { goals: Goal[]; year: number; onEdit: () => void }) {
  const rows = useMemo(() => {
    const list: { label: string; type: PeriodType; sort: number; goal: Goal | null }[] = []

    // Annual
    const annual = goals.find(g => g.period_type === 'annual') ?? null
    list.push({ label: `Annual ${year}`, type: 'annual', sort: 0, goal: annual })

    // Quarterly
    for (let q = 1; q <= 4; q++) {
      const g = goals.find(g => g.period_type === 'quarterly' && g.period_quarter === q) ?? null
      list.push({ label: `Q${q} ${year}`, type: 'quarterly', sort: q, goal: g })
    }

    // Monthly
    for (let m = 1; m <= 12; m++) {
      const g = goals.find(g => g.period_type === 'monthly' && g.period_month === m) ?? null
      list.push({ label: `${MONTH_NAMES[m - 1]} ${year}`, type: 'monthly', sort: m, goal: g })
    }

    return list.filter(r => r.goal !== null)
  }, [goals, year])

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">All Goals — {year}</h3>
        <p className="text-xs text-slate-400 mt-0.5">Overview of every target set for this year</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Period</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">FYC Target</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">ANP Target</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3 font-medium text-slate-700">{row.label}</td>
                <td className="px-4 py-3 text-right font-semibold text-indigo-600 tabular-nums">
                  {formatCurrency(row.goal!.fyc_target)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-violet-600 tabular-nums">
                  {formatCurrency(row.goal!.anp_target)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                    row.type === 'annual'    ? 'bg-sky-50 text-sky-700' :
                    row.type === 'quarterly' ? 'bg-violet-50 text-violet-700' :
                                               'bg-indigo-50 text-indigo-700'
                  }`}>
                    {row.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
