'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Shield, Save, Loader2, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn, relativeTime } from '@/lib/utils'
import type { PlanningChecklist } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHECKLIST_CATEGORIES = [
  {
    key: 'Life',
    label: 'Life',
    description: 'Life insurance coverage',
    color: 'indigo',
  },
  {
    key: 'Total Permanent Disability',
    label: 'Total Permanent Disability',
    description: 'TPD protection',
    color: 'violet',
  },
  {
    key: 'Critical Illness',
    label: 'Critical Illness',
    description: 'CI coverage for major illnesses',
    color: 'purple',
  },
  {
    key: 'Accidental Death and Disability',
    label: 'Accidental Death & Disability',
    description: 'ADD protection',
    color: 'blue',
  },
  {
    key: 'Long-Term Care',
    label: 'Long-Term Care',
    description: 'Extended care coverage',
    color: 'cyan',
  },
  {
    key: 'Hospital and Surgical',
    label: 'Hospital & Surgical',
    description: 'Medical and hospitalisation',
    color: 'teal',
  },
  {
    key: 'Savings & Investments',
    label: 'Savings & Investments',
    description: 'Retirement and wealth planning',
    color: 'emerald',
  },
]

function getStatusConfig(fulfilled: number, total: number) {
  const pct = total > 0 ? (fulfilled / total) * 100 : 0
  if (pct === 100) return { label: 'Complete',       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' }
  if (pct >= 70)  return { label: 'Mostly Covered',  color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       bar: 'bg-blue-500' }
  if (pct >= 40)  return { label: 'Needs Review',    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     bar: 'bg-amber-500' }
  return               { label: 'Major Gaps',       color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         bar: 'bg-red-500' }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CoverageChecklistProps {
  initialItems: PlanningChecklist[]
  clientId:     string
  userId:       string
}

export default function CoverageChecklist({ initialItems, clientId, userId }: CoverageChecklistProps) {
  const [items,       setItems]       = useState<PlanningChecklist[]>(initialItems)
  const [dirty,       setDirty]       = useState<Set<string>>(new Set())
  const [toggling,    setToggling]    = useState<Set<string>>(new Set())
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)

  // ── Initialise missing items on mount ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const missing = CHECKLIST_CATEGORIES.filter(
        cat => !items.find(i => i.category_name === cat.key)
      )
      if (missing.length === 0) { setInitialised(true); return }

      const supabase = createClient() as any
      const rows = missing.map(cat => ({
        user_id:       userId,
        client_id:     clientId,
        category_name: cat.key,
        is_fulfilled:  false,
        remarks:       null,
        last_reviewed_at: null,
      }))

      const { data, error } = await supabase
        .from('client_planning_checklist')
        .insert(rows)
        .select()

      if (!error && data) {
        setItems(prev => [...prev, ...(data as PlanningChecklist[])])
      }
      setInitialised(true)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle fulfilled (auto-save) ───────────────────────────────────────────
  const toggleFulfilled = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const newVal = !item.is_fulfilled
    const now    = new Date().toISOString()

    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, is_fulfilled: newVal, last_reviewed_at: now } : i
    ))
    setToggling(prev => new Set(prev).add(itemId))

    const supabase = createClient() as any
    const { error } = await supabase
      .from('client_planning_checklist')
      .update({ is_fulfilled: newVal, last_reviewed_at: now })
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === itemId ? item : i))
    }
    setToggling(prev => { const n = new Set(prev); n.delete(itemId); return n })
  }, [items, userId])

  // ── Update remarks locally ─────────────────────────────────────────────────
  const updateRemarks = useCallback((itemId: string, remarks: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, remarks } : i))
    setDirty(prev => new Set(prev).add(itemId))
    setSaveError(null)
  }, [])

  // ── Save all dirty remarks ─────────────────────────────────────────────────
  const saveRemarks = useCallback(async () => {
    if (dirty.size === 0) return
    setSaving(true)
    setSaveError(null)

    const supabase = createClient() as any
    try {
      await Promise.all(
        Array.from(dirty).map(id => {
          const item = items.find(i => i.id === id)
          if (!item) return Promise.resolve()
          return supabase
            .from('client_planning_checklist')
            .update({ remarks: item.remarks })
            .eq('id', id)
            .eq('user_id', userId)
        })
      )
      setDirty(new Set())
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to save remarks')
    } finally {
      setSaving(false)
    }
  }, [dirty, items, userId])

  // ── Derived values ─────────────────────────────────────────────────────────
  const orderedItems = CHECKLIST_CATEGORIES.map(cat =>
    items.find(i => i.category_name === cat.key)
  )

  const fulfilledCount = items.filter(i => i.is_fulfilled).length
  const total          = CHECKLIST_CATEGORIES.length
  const pct            = total > 0 ? Math.round((fulfilledCount / total) * 100) : 0
  const status         = getStatusConfig(fulfilledCount, total)
  const missingItems   = CHECKLIST_CATEGORIES.filter(
    cat => !items.find(i => i.category_name === cat.key && i.is_fulfilled)
  )

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartColor  = pct === 100 ? '#10b981' : pct >= 70 ? '#6366f1' : pct >= 43 ? '#f59e0b' : '#ef4444'
  const chartData = [
    { name: 'Covered', value: fulfilledCount },
    { name: 'Missing', value: total - fulfilledCount },
  ]

  return (
    <div className="space-y-5">

      {/* ── Planning Snapshot card ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">Planning Snapshot</h3>
            </div>
            <p className="text-xs text-slate-400">Coverage &amp; Retirement Readiness Overview</p>
          </div>
          <span className={cn('rounded-full border px-3 py-1 text-xs font-bold', status.bg, status.color)}>
            {status.label}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">

          {/* Donut chart */}
          <div className="relative shrink-0 w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={68}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                  paddingAngle={fulfilledCount > 0 && fulfilledCount < total ? 3 : 0}
                >
                  <Cell fill={chartColor} />
                  <Cell fill="#e2e8f0" />
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} area${value !== 1 ? 's' : ''}`, name as string]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{pct}%</span>
              <span className="text-[10px] text-slate-400 font-medium">Covered</span>
            </div>
          </div>

          {/* Stats + legend */}
          <div className="flex-1 w-full space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColor }} />
                <span className="text-xs text-slate-600">Covered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="text-xs text-slate-600">Missing</span>
              </div>
            </div>

            {/* Stat cells */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                  {fulfilledCount}<span className="text-sm text-slate-400">/{total}</span>
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Areas Covered</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">{total - fulfilledCount}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Gaps</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-center">
                <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: chartColor }}>{pct}%</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Complete</p>
              </div>
            </div>

            {/* Missing areas */}
            {missingItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Missing areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingItems.map(cat => (
                    <span key={cat.key} className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-medium text-red-600">
                      {cat.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Checklist rows ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Coverage Checklist</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tick each area once covered — remarks save separately</p>
          </div>
          {dirty.size > 0 && (
            <button
              onClick={saveRemarks}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Save className="h-3 w-3" />
              }
              {saving ? 'Saving…' : `Save Remarks (${dirty.size})`}
            </button>
          )}
        </div>

        {saveError && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {saveError}
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {CHECKLIST_CATEGORIES.map((cat, idx) => {
            const item = orderedItems[idx]
            const isToggling = item ? toggling.has(item.id) : false
            const isDirty    = item ? dirty.has(item.id) : false
            const fulfilled  = item?.is_fulfilled ?? false

            return (
              <div
                key={cat.key}
                className={cn(
                  'px-5 py-4 transition-colors',
                  fulfilled ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => item && toggleFulfilled(item.id)}
                    disabled={!item || isToggling}
                    className={cn(
                      'mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                      fulfilled
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 hover:border-indigo-400',
                      (!item || isToggling) && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    {isToggling
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : fulfilled
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : null
                    }
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        'text-sm font-semibold',
                        fulfilled ? 'text-slate-700' : 'text-slate-800'
                      )}>
                        {cat.label}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        fulfilled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-600'
                      )}>
                        {fulfilled
                          ? <><CheckCircle2 className="h-2.5 w-2.5" /> Covered</>
                          : <><XCircle className="h-2.5 w-2.5" /> Missing</>
                        }
                      </span>
                      {item?.last_reviewed_at && (
                        <span className="text-[10px] text-slate-400">
                          Reviewed {relativeTime(item.last_reviewed_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cat.description}</p>

                    {/* Remarks */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={item?.remarks ?? ''}
                        onChange={e => item && updateRemarks(item.id, e.target.value)}
                        disabled={!item}
                        placeholder="Add remarks (optional)…"
                        className={cn(
                          'flex-1 rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 transition',
                          isDirty
                            ? 'border-indigo-300 focus:ring-indigo-400'
                            : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-300',
                          !item && 'opacity-40 cursor-not-allowed'
                        )}
                      />
                      {isDirty && (
                        <span className="text-[10px] text-indigo-500 font-medium whitespace-nowrap">unsaved</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer disclaimer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400 italic">
            This checklist is a brief planning overview only and is not a replacement for a full portfolio analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
