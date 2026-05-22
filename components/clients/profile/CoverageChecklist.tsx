'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, Shield, Save, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, relativeTime } from '@/lib/utils'
import type { PlanningChecklist } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHECKLIST_CATEGORIES = [
  { key: 'Life',                             label: 'Life',                       short: 'Life', description: 'Life insurance coverage' },
  { key: 'Total Permanent Disability',       label: 'Total Permanent Disability', short: 'TPD',  description: 'TPD protection' },
  { key: 'Critical Illness',                 label: 'Critical Illness',           short: 'CI',   description: 'CI coverage for major illnesses' },
  { key: 'Accidental Death and Disability',  label: 'Accidental Death & Disability', short: 'ADD', description: 'ADD protection' },
  { key: 'Long-Term Care',                   label: 'Long-Term Care',             short: 'LTC',  description: 'Extended care coverage' },
  { key: 'Hospital and Surgical',            label: 'Hospital & Surgical',        short: 'H&S',  description: 'Medical and hospitalisation' },
  { key: 'Savings & Investments',            label: 'Savings & Investments',      short: 'S&I',  description: 'Retirement and wealth planning' },
]

function getStatusConfig(avgPct: number) {
  if (avgPct === 100) return { label: 'Complete',       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
  if (avgPct >= 70)  return { label: 'Mostly Covered',  color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' }
  if (avgPct >= 40)  return { label: 'Needs Review',    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' }
  return               { label: 'Major Gaps',          color: 'text-red-600',     bg: 'bg-red-50 border-red-200' }
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

const CX = 140, CY = 140, RO = 92, RI = 56, LABEL_R = 116
const N       = CHECKLIST_CATEGORIES.length
const SEG_DEG = 360 / N
const GAP_DEG = 3
const EFF_DEG = SEG_DEG - GAP_DEG

function polar(r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function arcPath(ro: number, ri: number, a1: number, a2: number): string {
  if (Math.abs(a2 - a1) < 0.1) return ''
  const p1 = polar(ro, a1), p2 = polar(ro, a2)
  const p3 = polar(ri, a2), p4 = polar(ri, a1)
  const large = a2 - a1 > 180 ? 1 : 0
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${ro} ${ro} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function CoverageDonut({ orderedItems }: { orderedItems: (PlanningChecklist | undefined)[] }) {
  const avgPct = Math.round(
    orderedItems.reduce((s, i) => s + (i?.coverage_pct ?? 0), 0) / N
  )
  const avgColor = avgPct === 100 ? '#10b981' : avgPct >= 70 ? '#6366f1' : avgPct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[240px] mx-auto">
      {CHECKLIST_CATEGORIES.map((cat, i) => {
        const pct        = orderedItems[i]?.coverage_pct ?? 0
        const segStart   = i * SEG_DEG + GAP_DEG / 2
        const segEnd     = segStart + EFF_DEG
        const filledEnd  = segStart + (pct / 100) * EFF_DEG

        // Background slice colour: amber if partially covered (shows the gap), gray if fully missing
        const bgFill     = pct > 0 && pct < 100 ? '#fde68a' : '#e2e8f0'
        // Covered arc colour: emerald if 100%, indigo otherwise
        const fillColor  = pct === 100 ? '#10b981' : '#6366f1'

        const midAngle   = i * SEG_DEG + SEG_DEG / 2
        const lp         = polar(LABEL_R, midAngle)
        const anchor     = lp.x > CX + 8 ? 'start' : lp.x < CX - 8 ? 'end' : 'middle'
        const labelColor = pct === 0 ? '#94a3b8' : pct === 100 ? '#065f46' : '#3730a3'

        return (
          <g key={cat.key}>
            {/* Background (full segment) */}
            <path d={arcPath(RO, RI, segStart, segEnd)} fill={bgFill} />
            {/* Covered portion */}
            {pct > 0 && (
              <path d={arcPath(RO, RI, segStart, filledEnd)} fill={fillColor} />
            )}
            {/* Segment label */}
            <text
              x={lp.x.toFixed(2)}
              y={lp.y.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="700"
              fill={labelColor}
              style={{ userSelect: 'none' }}
            >
              {cat.short}
            </text>
          </g>
        )
      })}

      {/* Centre text */}
      <text x={CX} y={CY - 12} textAnchor="middle" fontSize="30" fontWeight="800" fill="#0f172a" style={{ userSelect: 'none' }}>
        {avgPct}%
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="500" style={{ userSelect: 'none' }}>
        avg covered
      </text>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CoverageChecklistProps {
  initialItems: PlanningChecklist[]
  clientId:     string
  userId:       string
}

export default function CoverageChecklist({ initialItems, clientId, userId }: CoverageChecklistProps) {
  const [items,      setItems]      = useState<PlanningChecklist[]>(initialItems)
  const [dirty,      setDirty]      = useState<Set<string>>(new Set())
  const [toggling,   setToggling]   = useState<Set<string>>(new Set())
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const pctTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Initialise missing items ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const missing = CHECKLIST_CATEGORIES.filter(
        cat => !items.find(i => i.category_name === cat.key)
      )
      if (missing.length === 0) return
      const supabase = createClient() as any
      const rows = missing.map(cat => ({
        user_id: userId, client_id: clientId,
        category_name: cat.key, is_fulfilled: false,
        coverage_pct: 0, remarks: null, last_reviewed_at: null,
      }))
      const { data, error } = await supabase
        .from('client_planning_checklist').insert(rows).select()
      if (!error && data) setItems(prev => [...prev, ...(data as PlanningChecklist[])])
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist coverage_pct + is_fulfilled ───────────────────────────────────
  const persistPct = useCallback(async (itemId: string, pct: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const supabase = createClient() as any
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('client_planning_checklist')
      .update({ coverage_pct: pct, is_fulfilled: pct === 100, last_reviewed_at: now })
      .eq('id', itemId).eq('user_id', userId)
    if (error) setItems(prev => prev.map(i => i.id === itemId ? item : i))
  }, [items, userId])

  // ── Slider: optimistic local update + debounced DB save ───────────────────
  const handleSlider = useCallback((itemId: string, pct: number) => {
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, coverage_pct: pct, is_fulfilled: pct === 100 } : i
    ))
    clearTimeout(pctTimers.current[itemId])
    pctTimers.current[itemId] = setTimeout(() => persistPct(itemId, pct), 600)
  }, [persistPct])

  // ── Checkbox: toggle 0 ↔ 100 ─────────────────────────────────────────────
  const toggleFulfilled = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const newPct = (item.coverage_pct ?? 0) >= 100 ? 0 : 100
    const now    = new Date().toISOString()
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, coverage_pct: newPct, is_fulfilled: newPct === 100, last_reviewed_at: now } : i
    ))
    setToggling(prev => new Set(prev).add(itemId))
    const supabase = createClient() as any
    const { error } = await supabase
      .from('client_planning_checklist')
      .update({ coverage_pct: newPct, is_fulfilled: newPct === 100, last_reviewed_at: now })
      .eq('id', itemId).eq('user_id', userId)
    if (error) setItems(prev => prev.map(i => i.id === itemId ? item : i))
    setToggling(prev => { const n = new Set(prev); n.delete(itemId); return n })
  }, [items, userId])

  // ── Remarks ───────────────────────────────────────────────────────────────
  const updateRemarks = useCallback((itemId: string, remarks: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, remarks } : i))
    setDirty(prev => new Set(prev).add(itemId))
    setSaveError(null)
  }, [])

  const saveRemarks = useCallback(async () => {
    if (dirty.size === 0) return
    setSaving(true); setSaveError(null)
    const supabase = createClient() as any
    try {
      await Promise.all(Array.from(dirty).map(id => {
        const item = items.find(i => i.id === id)
        if (!item) return Promise.resolve()
        return supabase.from('client_planning_checklist')
          .update({ remarks: item.remarks }).eq('id', id).eq('user_id', userId)
      }))
      setDirty(new Set())
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to save remarks')
    } finally {
      setSaving(false)
    }
  }, [dirty, items, userId])

  // ── Derived ───────────────────────────────────────────────────────────────
  const orderedItems   = CHECKLIST_CATEGORIES.map(cat => items.find(i => i.category_name === cat.key))
  const avgPct         = Math.round(orderedItems.reduce((s, i) => s + (i?.coverage_pct ?? 0), 0) / N)
  const fullyCount     = orderedItems.filter(i => (i?.coverage_pct ?? 0) === 100).length
  const partialCount   = orderedItems.filter(i => { const p = i?.coverage_pct ?? 0; return p > 0 && p < 100 }).length
  const missingCount   = N - fullyCount - partialCount
  const status         = getStatusConfig(avgPct)
  const avgColor       = avgPct === 100 ? '#10b981' : avgPct >= 70 ? '#6366f1' : avgPct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-5">

      {/* ── Planning Snapshot ────────────────────────────────────────────── */}
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

          {/* Donut */}
          <div className="shrink-0 w-56">
            <CoverageDonut orderedItems={orderedItems} />
          </div>

          {/* Right panel */}
          <div className="flex-1 w-full space-y-4">

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                { color: '#10b981', label: 'Fully covered' },
                { color: '#6366f1', label: 'Partial coverage' },
                { color: '#fde68a', label: 'Coverage gap' },
                { color: '#e2e8f0', label: 'Missing' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="text-xs text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Mini bar per category */}
            <div className="space-y-1.5">
              {CHECKLIST_CATEGORIES.map((cat, i) => {
                const pct = orderedItems[i]?.coverage_pct ?? 0
                const barColor = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-slate-200'
                const pctColor = pct === 100 ? '#10b981' : pct > 0 ? '#6366f1' : '#94a3b8'
                return (
                  <div key={cat.key} className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 w-8 shrink-0">{cat.short}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', barColor)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums w-8 text-right shrink-0" style={{ color: pctColor }}>
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: fullyCount,   sub: `/${N}`, label: 'Fully Covered', color: '#10b981' },
                { value: partialCount, sub: '',       label: 'Partial',       color: '#6366f1' },
                { value: missingCount, sub: '',       label: 'Missing',       color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-2.5 text-center">
                  <p className="text-base font-bold tabular-nums leading-tight" style={{ color: s.color }}>
                    {s.value}<span className="text-xs text-slate-400">{s.sub}</span>
                  </p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Checklist rows ────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Coverage Checklist</h3>
            <p className="text-xs text-slate-400 mt-0.5">Drag the slider to set coverage — tick to mark fully covered</p>
          </div>
          {dirty.size > 0 && (
            <button
              onClick={saveRemarks}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
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
            const item        = orderedItems[idx]
            const isToggling  = item ? toggling.has(item.id) : false
            const isDirty     = item ? dirty.has(item.id) : false
            const pct         = item?.coverage_pct ?? 0
            const fulfilled   = pct === 100
            const partial     = pct > 0 && pct < 100
            const pctColor    = fulfilled ? '#10b981' : partial ? '#6366f1' : '#94a3b8'

            return (
              <div
                key={cat.key}
                className={cn(
                  'px-5 py-4 transition-colors',
                  fulfilled ? 'bg-emerald-50/30' : partial ? 'bg-indigo-50/10' : 'hover:bg-slate-50/60'
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
                        : partial
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-300 hover:border-indigo-400',
                      (!item || isToggling) && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    {isToggling
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : fulfilled
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : null}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-semibold', fulfilled ? 'text-slate-700' : 'text-slate-800')}>
                        {cat.label}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        fulfilled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : partial
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-red-50 border-red-200 text-red-600'
                      )}>
                        {fulfilled
                          ? <><CheckCircle2 className="h-2.5 w-2.5" /> Covered</>
                          : partial
                          ? <>Partial &bull; {pct}%</>
                          : <><XCircle className="h-2.5 w-2.5" /> Missing</>}
                      </span>
                      {item?.last_reviewed_at && (
                        <span className="text-[10px] text-slate-400">
                          Reviewed {relativeTime(item.last_reviewed_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cat.description}</p>

                    {/* Coverage slider */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 shrink-0 w-[68px]">Coverage</span>
                      <input
                        type="range"
                        min="0" max="100" step="5"
                        value={pct}
                        onChange={e => item && handleSlider(item.id, parseInt(e.target.value))}
                        disabled={!item}
                        className="flex-1 h-1.5 accent-indigo-600 disabled:opacity-40 cursor-pointer"
                      />
                      <span
                        className="text-xs font-bold tabular-nums w-9 text-right shrink-0"
                        style={{ color: pctColor }}
                      >
                        {pct}%
                      </span>
                    </div>

                    {/* Remarks */}
                    <div className="mt-2 flex items-center gap-2">
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

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400 italic">
            This checklist is a brief planning overview only and is not a replacement for a full portfolio analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
