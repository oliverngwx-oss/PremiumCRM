'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent as DragEndEventType,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Calendar, TrendingUp, DollarSign, Percent,
  ChevronRight, Pencil, Trash2, X, Loader2, ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, formatDate, getInitials, relativeTime } from '@/lib/utils'
import type { Opportunity, Tag } from '@/types/database'
import type { OppWithClient } from '@/app/(app)/pipeline/page'
import OpportunityModal from '@/components/clients/profile/OpportunityModal'
import DeleteModal from '@/components/clients/DeleteModal'

// ─── Stage config ─────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  { id: 'new_lead',         label: 'New Lead',         short: 'New',    accent: '#6366f1', bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-600'  },
  { id: 'contacted',        label: 'Contacted',        short: 'Cnt.',   accent: '#3b82f6', bg: 'bg-blue-50',    ring: 'ring-blue-200',    text: 'text-blue-600'    },
  { id: 'appointment_set',  label: 'Appointment Set',  short: 'Appt.',  accent: '#06b6d4', bg: 'bg-cyan-50',    ring: 'ring-cyan-200',    text: 'text-cyan-600'    },
  { id: 'fact_find',        label: 'Fact Find',        short: 'FF',     accent: '#8b5cf6', bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-600'  },
  { id: 'proposal',         label: 'Proposal',         short: 'Prop.',  accent: '#f59e0b', bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-600'   },
  { id: 'closing',          label: 'Closing',          short: 'Close',  accent: '#f97316', bg: 'bg-orange-50',  ring: 'ring-orange-200',  text: 'text-orange-600'  },
  { id: 'won',              label: 'Won',              short: 'Won',    accent: '#10b981', bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-600' },
  { id: 'lost',             label: 'Lost',             short: 'Lost',   accent: '#ef4444', bg: 'bg-red-50',     ring: 'ring-red-200',     text: 'text-red-500'     },
  { id: 'follow_up_later',  label: 'Follow Up Later',  short: 'Later',  accent: '#94a3b8', bg: 'bg-slate-100',  ring: 'ring-slate-200',   text: 'text-slate-500'   },
] as const

type StageId = typeof PIPELINE_STAGES[number]['id']

type BoardState = Record<StageId, OppWithClient[]>

function groupByStage(opps: OppWithClient[]): BoardState {
  const board = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s.id, [] as OppWithClient[]])
  ) as BoardState
  for (const opp of opps) {
    const stage = opp.stage as StageId
    if (board[stage]) {
      board[stage].push(opp)
    } else {
      board['new_lead'].push(opp)
    }
  }
  return board
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OppCard({
  opp,
  isOverlay = false,
  onClick,
}: {
  opp: OppWithClient
  isOverlay?: boolean
  onClick?: () => void
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, isDragging,
  } = useDraggable({ id: opp.id, data: { opp } })

  const stage = PIPELINE_STAGES.find(s => s.id === opp.stage)

  const style = isOverlay
    ? undefined
    : (transform ? { transform: CSS.Translate.toString(transform) } : undefined)

  const clientName = opp.clients?.preferred_name ?? opp.clients?.full_name ?? 'Unknown'
  const initials = opp.clients?.full_name ? getInitials(opp.clients.full_name) : '?'
  const today = new Date()
  const nextActionDate = opp.next_action_date ? new Date(opp.next_action_date) : null
  const isOverdue = nextActionDate && nextActionDate < today && opp.stage !== 'won' && opp.stage !== 'lost'

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      onClick={!isDragging && !isOverlay ? onClick : undefined}
      className={cn(
        'group rounded-xl bg-white border border-slate-200/80 p-3.5 shadow-sm',
        'cursor-grab active:cursor-grabbing select-none',
        'hover:shadow-md hover:border-slate-300 transition-all duration-150',
        isDragging && !isOverlay && 'opacity-30 shadow-none',
        isOverlay && 'shadow-2xl ring-2 ring-indigo-300 rotate-1 cursor-grabbing',
      )}
    >
      {/* Client row */}
      <div className="flex items-center gap-2 mb-2">
        {opp.clients?.profile_photo_url ? (
          <img
            src={opp.clients.profile_photo_url}
            alt={clientName}
            className="h-6 w-6 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-slate-500">{initials}</span>
          </div>
        )}
        <span className="text-xs font-medium text-slate-500 truncate">{clientName}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-900 leading-snug mb-2.5 line-clamp-2">
        {opp.title}
      </p>

      {/* Product type */}
      {opp.product_type && (
        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 mb-2">
          {opp.product_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      )}

      {/* Financials */}
      <div className="flex items-center gap-3 mb-2">
        {opp.estimated_fyc != null && (
          <div>
            <p className="text-[10px] text-slate-400">FYC</p>
            <p className="text-xs font-bold text-slate-800">{formatCurrency(opp.estimated_fyc)}</p>
          </div>
        )}
        {opp.estimated_anp != null && (
          <div>
            <p className="text-[10px] text-slate-400">ANP</p>
            <p className="text-xs font-bold text-slate-800">{formatCurrency(opp.estimated_anp)}</p>
          </div>
        )}
      </div>

      {/* Probability bar */}
      {opp.probability != null && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">Probability</span>
            <span className="text-[10px] font-semibold text-slate-600">{opp.probability}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100">
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${opp.probability}%`,
                backgroundColor: stage?.accent ?? '#6366f1',
              }}
            />
          </div>
        </div>
      )}

      {/* Next action date */}
      {opp.next_action_date && (
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOverdue ? 'text-red-500' : 'text-slate-400'
        )}>
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="text-[10px] font-medium">
            {isOverdue ? 'Overdue · ' : ''}
            {formatDate(opp.next_action_date)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  opps,
  onCardClick,
  onAddClick,
}: {
  stage: typeof PIPELINE_STAGES[number]
  opps: OppWithClient[]
  onCardClick: (opp: OppWithClient) => void
  onAddClick: (stageId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const totalFYC = opps.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)

  return (
    <div className="flex flex-col w-64 shrink-0 h-full">
      {/* Column header */}
      <div
        className="shrink-0 rounded-t-xl px-3 py-2.5 mb-0"
        style={{ borderTop: `3px solid ${stage.accent}`, backgroundColor: 'white' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('text-xs font-bold truncate', stage.text)}>{stage.label}</span>
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {opps.length}
            </span>
          </div>
          <button
            onClick={() => onAddClick(stage.id)}
            className="rounded-lg p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            title={`Add to ${stage.label}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {totalFYC > 0 && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {formatCurrency(totalFYC, true)} FYC
          </p>
        )}
      </div>

      {/* Droppable card area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto rounded-b-xl p-2 space-y-2',
          'border border-t-0 border-slate-200/80 transition-colors duration-150',
          isOver ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-50/50',
        )}
      >
        {opps.map(opp => (
          <OppCard
            key={opp.id}
            opp={opp}
            onClick={() => onCardClick(opp)}
          />
        ))}

        {/* Empty column drop hint */}
        {opps.length === 0 && (
          <div className={cn(
            'flex items-center justify-center h-20 rounded-lg border-2 border-dashed transition-colors',
            isOver ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
          )}>
            <p className="text-xs text-slate-400">
              {isOver ? 'Drop here' : 'Empty'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Opportunity detail modal ─────────────────────────────────────────────────

function OppDetailModal({
  opp,
  userId,
  onClose,
  onEdit,
  onDeleted,
}: {
  opp: OppWithClient
  userId: string
  onClose: () => void
  onEdit: () => void
  onDeleted: (id: string) => void
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const stage = PIPELINE_STAGES.find(s => s.id === opp.stage)
  const clientName = opp.clients?.full_name ?? 'Unknown'

  async function handleDelete() {
    setDeleting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any
      await db.from('opportunities').delete().eq('id', opp.id)
      onDeleted(opp.id)
    } finally {
      setDeleting(false)
    }
  }

  const PRODUCT_LABELS: Record<string, string> = {
    life_insurance: 'Life Insurance', health_insurance: 'Health Insurance',
    investment: 'Investment', retirement: 'Retirement', annuity: 'Annuity',
    disability: 'Disability', critical_illness: 'Critical Illness',
    general_insurance: 'General Insurance', other: 'Other',
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Colour band */}
          <div className="h-1.5 w-full" style={{ backgroundColor: stage?.accent ?? '#6366f1' }} />

          <div className="px-6 pt-5 pb-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border', stage?.bg, stage?.text, stage?.ring.replace('ring', 'border'))}
                  >
                    {stage?.label ?? opp.stage}
                  </span>
                  {opp.product_type && (
                    <span className="text-[10px] text-slate-400">
                      {PRODUCT_LABELS[opp.product_type] ?? opp.product_type}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{opp.title}</h2>
              </div>
              <button onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Client */}
            {opp.clients && (
              <Link
                href={`/clients/${opp.clients.id}`}
                onClick={onClose}
                className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 transition-colors group"
              >
                {opp.clients.profile_photo_url ? (
                  <img src={opp.clients.profile_photo_url} alt={clientName} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-600">{getInitials(clientName)}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 truncate">{clientName}</p>
                  <p className="text-[10px] text-slate-400">View client profile</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
              </Link>
            )}

            {/* Financials */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Est. FYC', value: opp.estimated_fyc != null ? formatCurrency(opp.estimated_fyc) : '—' },
                { label: 'Est. ANP', value: opp.estimated_anp != null ? formatCurrency(opp.estimated_anp) : '—' },
                { label: 'Probability', value: opp.probability != null ? `${opp.probability}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Probability bar */}
            {opp.probability != null && (
              <div className="mb-4">
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${opp.probability}%`, backgroundColor: stage?.accent ?? '#6366f1' }}
                  />
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="space-y-2 mb-4">
              {opp.expected_close_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Expected Close</span>
                  <span className="font-medium text-slate-800">{formatDate(opp.expected_close_date)}</span>
                </div>
              )}
              {opp.next_action_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Next Action</span>
                  <span className="font-medium text-slate-800">{formatDate(opp.next_action_date)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-400">{relativeTime(opp.created_at)}</span>
              </div>
            </div>

            {/* Next action text */}
            {opp.next_action && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-amber-600 mb-0.5">Next Action</p>
                <p className="text-sm text-amber-800">{opp.next_action}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between px-6 pb-5">
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Opportunity
            </button>
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <DeleteModal
          title="Delete Opportunity"
          description={`Delete "${opp.title}"? This cannot be undone.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

interface PipelineBoardProps {
  initialOpps: OppWithClient[]
  allTags: Tag[]
  userId: string
}

export default function PipelineBoard({ initialOpps, userId }: PipelineBoardProps) {
  const [board, setBoard] = useState<BoardState>(() => groupByStage(initialOpps))
  const [activeOpp, setActiveOpp] = useState<OppWithClient | null>(null)
  const [selectedOpp, setSelectedOpp] = useState<OppWithClient | null>(null)
  const [editingOpp, setEditingOpp] = useState<OppWithClient | null>(null)
  const [addToStage, setAddToStage] = useState<string | null>(null)

  // We don't have allClients for the add form here; adding from client profile is the flow.
  // But we do support editing existing opps.

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const allOpps = PIPELINE_STAGES.flatMap(s => board[s.id])
  const openOpps = allOpps.filter(o => !['won', 'lost', 'follow_up_later'].includes(o.stage))
  const wonOpps = allOpps.filter(o => o.stage === 'won')
  const totalFYC = openOpps.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)
  const wonFYC = wonOpps.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)
  const winRate = (wonOpps.length + allOpps.filter(o => o.stage === 'lost').length) > 0
    ? Math.round(wonOpps.length / (wonOpps.length + allOpps.filter(o => o.stage === 'lost').length) * 100)
    : null

  function findStageOfOpp(id: string): StageId | undefined {
    return PIPELINE_STAGES.find(s => board[s.id].some(o => o.id === id))?.id as StageId | undefined
  }

  // ─── DnD handlers ───────────────────────────────────────────────────────────

  function onDragStart(event: DragStartEvent) {
    setActiveOpp(event.active.data.current?.opp ?? null)
  }

  function onDragEnd(event: DragEndEventType) {
    const { active, over } = event
    setActiveOpp(null)

    if (!over) return

    const targetStage = over.id as StageId
    const sourceStage = findStageOfOpp(active.id as string)

    if (!sourceStage || sourceStage === targetStage) return

    const opp = board[sourceStage].find(o => o.id === active.id)
    if (!opp) return

    const updated = { ...opp, stage: targetStage } as OppWithClient

    setBoard(prev => ({
      ...prev,
      [sourceStage]: prev[sourceStage].filter(o => o.id !== active.id),
      [targetStage]: [...prev[targetStage], updated],
    }))

    // Persist to DB (fire-and-forget; optimistic update already applied)
    const db = createClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    db.from('opportunities').update({ stage: targetStage }).eq('id', active.id)
  }

  // ─── Mutation callbacks ──────────────────────────────────────────────────────

  const handleOppSaved = useCallback(async () => {
    // Re-fetch the board after an edit/add
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const { data } = await db
      .from('opportunities')
      .select('*, clients(id, full_name, preferred_name, profile_photo_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setBoard(groupByStage(data as OppWithClient[]))
    setEditingOpp(null)
    setAddToStage(null)
    setSelectedOpp(null)
  }, [userId])

  const handleOppDeleted = useCallback((id: string) => {
    setBoard(prev => {
      const stage = PIPELINE_STAGES.find(s => prev[s.id].some(o => o.id === id))
      if (!stage) return prev
      return { ...prev, [stage.id]: prev[stage.id].filter(o => o.id !== id) }
    })
    setSelectedOpp(null)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-6 border-b border-slate-200/80 bg-white px-6 py-3.5">
        <div>
          <h1 className="text-base font-bold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-400">{allOpps.length} opportunities</p>
        </div>

        <div className="flex items-center gap-5 ml-4">
          <Stat label="Open FYC" value={formatCurrency(totalFYC, true)} icon={DollarSign} color="text-indigo-600" />
          <Stat label="Won FYC" value={formatCurrency(wonFYC, true)} icon={TrendingUp} color="text-emerald-600" />
          {winRate !== null && (
            <Stat label="Win Rate" value={`${winRate}%`} icon={Percent} color="text-amber-600" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/clients"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Add via Client
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full px-6 py-4" style={{ width: 'max-content', minWidth: '100%' }}>
            {PIPELINE_STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                opps={board[stage.id]}
                onCardClick={opp => { setSelectedOpp(opp); setEditingOpp(null) }}
                onAddClick={stageId => setAddToStage(stageId)}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeOpp && <OppCard opp={activeOpp} isOverlay />}
        </DragOverlay>
      </DndContext>

      {/* Opportunity detail modal */}
      {selectedOpp && !editingOpp && (
        <OppDetailModal
          opp={selectedOpp}
          userId={userId}
          onClose={() => setSelectedOpp(null)}
          onEdit={() => { setEditingOpp(selectedOpp); setSelectedOpp(null) }}
          onDeleted={handleOppDeleted}
        />
      )}

      {/* Edit opportunity modal */}
      {editingOpp && (
        <OpportunityModal
          open
          opportunity={editingOpp}
          clientId={editingOpp.client_id}
          userId={userId}
          onClose={() => setEditingOpp(null)}
          onSaved={handleOppSaved}
        />
      )}

      {/* Add opportunity — requires a client; redirect to clients page */}
      {addToStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddToStage(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Add Opportunity</h3>
            <p className="text-sm text-slate-500 mb-5">
              Opportunities are created from a client's profile page.
              Choose a client to get started.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setAddToStage(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <Link
                href="/clients"
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Go to Clients
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function Stat({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <div>
        <p className="text-[10px] text-slate-400 leading-none">{label}</p>
        <p className={cn('text-sm font-bold leading-tight', color)}>{value}</p>
      </div>
    </div>
  )
}
