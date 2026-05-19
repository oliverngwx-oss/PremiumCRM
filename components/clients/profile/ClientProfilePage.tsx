'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, Plus, Pin, PinOff, Trash2, Check,
  Phone, Mail, MapPin, Briefcase, Users, FileText,
  Calendar, Clock, ChevronRight, Download, Upload,
  Loader2, PhoneCall, Video, ClipboardList, Bell,
  Circle, CheckSquare, StickyNote, Activity, TrendingUp,
  File as FileIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatDateTime, relativeTime, formatCurrency, getInitials } from '@/lib/utils'
import type {
  Client, Tag, Opportunity, Note, Activity as ActivityType,
  UploadedFile, ActivityType as AType, PlanningChecklist,
} from '@/types/database'
import StatusBadge from '@/components/clients/StatusBadge'
import ClientFormDrawer from '@/components/clients/ClientFormDrawer'
import DeleteModal from '@/components/clients/DeleteModal'
import NoteDrawer from './NoteDrawer'
import ActivityDrawer from './ActivityDrawer'
import OpportunityModal from './OpportunityModal'
import CoverageChecklist from './CoverageChecklist'

// ─── Constants ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'pipeline' | 'notes' | 'meetings' | 'tasks' | 'files' | 'timeline' | 'coverage'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'pipeline',  label: 'Pipeline' },
  { id: 'notes',     label: 'Notes' },
  { id: 'meetings',  label: 'Meetings' },
  { id: 'tasks',     label: 'Tasks' },
  { id: 'files',     label: 'Files' },
  { id: 'timeline',  label: 'Timeline' },
  { id: 'coverage',  label: 'Coverage' },
]

const STAGE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  new_lead:        { label: 'New Lead',        dot: 'bg-indigo-400',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  contacted:       { label: 'Contacted',       dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  appointment_set: { label: 'Appt. Set',       dot: 'bg-cyan-400',    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  fact_find:       { label: 'Fact Find',       dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  proposal:        { label: 'Proposal',        dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  closing:         { label: 'Closing',         dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  won:             { label: 'Won',             dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost:            { label: 'Lost',            dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 border-red-200' },
  follow_up_later: { label: 'Follow Up Later', dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  meeting:      { label: 'Meeting',      Icon: Video,          color: 'text-indigo-500' },
  call:         { label: 'Call',         Icon: PhoneCall,      color: 'text-emerald-500' },
  email:        { label: 'Email',        Icon: Mail,           color: 'text-sky-500' },
  presentation: { label: 'Presentation', Icon: ClipboardList,  color: 'text-violet-500' },
  review:       { label: 'Review',       Icon: Activity,       color: 'text-orange-500' },
  task:         { label: 'Task',         Icon: CheckSquare,    color: 'text-slate-500' },
  follow_up:    { label: 'Follow-up',    Icon: Bell,           color: 'text-amber-500' },
  other:        { label: 'Other',        Icon: Circle,         color: 'text-slate-400' },
}

const STATUS_BADGE: Record<string, string> = {
  planned:     'bg-blue-50 text-blue-700 border-blue-200',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:   'bg-red-50 text-red-500 border-red-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
}

const MARITAL_LABELS: Record<string, string> = {
  single: 'Single', married: 'Married', divorced: 'Divorced',
  widowed: 'Widowed', separated: 'Separated', other: 'Other',
}

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral', cold_call: 'Cold Call', social_media: 'Social Media',
  event: 'Event', website: 'Website', existing_client: 'Existing Client',
  walk_in: 'Walk-in', other: 'Other',
}

const FILE_CATEGORY_LABELS: Record<string, string> = {
  kyc: 'KYC', proposal: 'Proposal', policy: 'Policy',
  id_document: 'ID Document', financial_statement: 'Financial',
  correspondence: 'Correspondence', other: 'Other',
}

const FILE_CATEGORIES = Object.entries(FILE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

// ─── Helper components ────────────────────────────────────────────────────────

function InfoCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('rounded-xl bg-white border border-slate-200/80 shadow-sm p-5', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-slate-50 last:border-0">
      <dt className="col-span-2 text-xs text-slate-500 flex items-center">{label}</dt>
      <dd className="col-span-3 text-sm text-slate-800 font-medium">{String(value)}</dd>
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-8 w-8 text-slate-300 mb-2" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function SectionHeader({ title, count, action }: {
  title: string; count?: number;
  action?: { label: string; icon?: React.ElementType; onClick: () => void }
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {count != null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {count}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          {action.icon ? <action.icon className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {action.label}
        </button>
      )}
    </div>
  )
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ClientProfilePageProps {
  client: Client
  tags: Tag[]
  allTags: Tag[]
  opportunities: Opportunity[]
  notes: Note[]
  activities: ActivityType[]
  files: UploadedFile[]
  checklist: PlanningChecklist[]
  userId: string
}

export default function ClientProfilePage({
  client: initialClient,
  tags: initialTags,
  allTags,
  opportunities: initialOpps,
  notes: initialNotes,
  activities: initialActivities,
  files: initialFiles,
  checklist: initialChecklist,
  userId,
}: ClientProfilePageProps) {

  // ─── Data state ────────────────────────────────────────────────────────────
  const [client, setClient] = useState(initialClient)
  const [tags, setTags] = useState(initialTags)
  const [opportunities, setOpps] = useState(initialOpps)
  const [notes, setNotes] = useState(initialNotes)
  const [activities, setActivities] = useState(initialActivities)
  const [files, setFiles] = useState(initialFiles)

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [noteDrawer, setNoteDrawer] = useState<{ open: boolean; note?: Note | null }>({ open: false })
  const [actDrawer, setActDrawer] = useState<{
    open: boolean; activity?: ActivityType | null; defaultType?: AType
  }>({ open: false })
  const [oppModal, setOppModal] = useState<{ open: boolean; opp?: Opportunity | null }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ─── Derived ───────────────────────────────────────────────────────────────
  const meetingActivities = activities.filter(a =>
    ['meeting', 'call', 'email', 'presentation', 'review'].includes(a.type)
  )
  const taskActivities = activities.filter(a => ['task', 'follow_up', 'other'].includes(a.type))
  const openTaskCount = taskActivities.filter(a =>
    a.status === 'planned' || a.status === 'rescheduled'
  ).length

  const totalFYC = opportunities.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)
  const totalANP = opportunities.reduce((s, o) => s + (o.estimated_anp ?? 0), 0)

  const timelineItems = useMemo(() => {
    const items = [
      ...activities.map(a => ({
        kind: 'activity' as const, data: a,
        date: a.scheduled_at ?? a.created_at,
      })),
      ...notes.map(n => ({
        kind: 'note' as const, data: n,
        date: n.meeting_date ? `${n.meeting_date}T00:00:00Z` : n.created_at,
      })),
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [activities, notes])

  // ─── Refetch ───────────────────────────────────────────────────────────────
  const refetchNotes = useCallback(async () => {
    const { data } = await db.from('notes').select('*').eq('client_id', client.id)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
    setNotes(data ?? [])
  }, [client.id])

  const refetchActivities = useCallback(async () => {
    const { data } = await db.from('activities').select('*').eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setActivities(data ?? [])
  }, [client.id])

  const refetchOpps = useCallback(async () => {
    const { data } = await db.from('opportunities').select('*').eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setOpps(data ?? [])
  }, [client.id])

  const refetchFiles = useCallback(async () => {
    const { data } = await db.from('uploaded_files').select('*').eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setFiles(data ?? [])
  }, [client.id])

  // ─── Mutations ─────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { type, id } = deleteTarget
      if (type === 'note') {
        await db.from('notes').delete().eq('id', id)
        await refetchNotes()
      } else if (type === 'activity') {
        await db.from('activities').delete().eq('id', id)
        await refetchActivities()
      } else if (type === 'opp') {
        await db.from('opportunities').delete().eq('id', id)
        await refetchOpps()
      } else if (type === 'file') {
        const f = files.find(f => f.id === id)
        if (f) await supabase.storage.from('client-files').remove([f.storage_path])
        await db.from('uploaded_files').delete().eq('id', id)
        await refetchFiles()
      }
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  async function togglePin(note: Note) {
    await db.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id)
    await refetchNotes()
  }

  async function toggleActivity(activity: ActivityType) {
    const newStatus = activity.status === 'completed' ? 'planned' : 'completed'
    await db.from('activities').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', activity.id)
    await refetchActivities()
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const path = `${userId}/${client.id}/${Date.now()}-${file.name}`
      const { error: se } = await supabase.storage.from('client-files').upload(path, file)
      if (se) throw se
      await db.from('uploaded_files').insert({
        user_id: userId, client_id: client.id,
        name: file.name, storage_path: path,
        size_bytes: file.size, mime_type: file.type,
        category: uploadCategory || null,
      })
      await refetchFiles()
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function downloadFile(file: UploadedFile) {
    const { data } = await supabase.storage
      .from('client-files').createSignedUrl(file.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ─── Section renderers ─────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <InfoCard title="Personal" icon={Users}>
        <dl>
          <InfoRow label="Age" value={client.age} />
          <InfoRow label="Date of Birth" value={client.date_of_birth ? formatDate(client.date_of_birth) : null} />
          <InfoRow label="Preferred Name" value={client.preferred_name} />
        </dl>
        {!client.age && !client.date_of_birth && !client.preferred_name && (
          <p className="text-xs text-slate-400 py-2">No personal details recorded.</p>
        )}
      </InfoCard>

      <InfoCard title="Contact" icon={Phone}>
        <dl>
          <InfoRow label="Email" value={client.email} />
          <InfoRow label="Phone" value={client.phone} />
          <InfoRow label="Address" value={client.address} />
        </dl>
        {!client.email && !client.phone && !client.address && (
          <p className="text-xs text-slate-400 py-2">No contact details recorded.</p>
        )}
      </InfoCard>

      <InfoCard title="Family" icon={Users}>
        <dl>
          <InfoRow
            label="Marital Status"
            value={client.marital_status ? MARITAL_LABELS[client.marital_status] ?? client.marital_status : null}
          />
          <InfoRow label="Children" value={client.number_of_children ?? 0} />
        </dl>
        {!client.marital_status && !client.number_of_children && (
          <p className="text-xs text-slate-400 py-2">No family details recorded.</p>
        )}
      </InfoCard>

      <InfoCard title="Occupation &amp; Company" icon={Briefcase}>
        <dl>
          <InfoRow label="Occupation" value={client.occupation} />
          <InfoRow label="Company" value={client.company} />
          <InfoRow label="Source" value={client.source ? SOURCE_LABELS[client.source] ?? client.source : null} />
          <InfoRow
            label="Client Type"
            value={client.client_type
              ? client.client_type.charAt(0).toUpperCase() + client.client_type.slice(1)
              : null}
          />
        </dl>
        {!client.occupation && !client.company && (
          <p className="text-xs text-slate-400 py-2">No work details recorded.</p>
        )}
      </InfoCard>

      {client.notes && (
        <div className="md:col-span-2">
          <InfoCard title="General Notes" icon={StickyNote}>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
          </InfoCard>
        </div>
      )}
    </div>
  )

  const renderPipeline = () => {
    const wonOpps = opportunities.filter(o => o.stage === 'won')
    const wonFYC = wonOpps.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)

    return (
      <div>
        <SectionHeader
          title="Opportunities"
          count={opportunities.length}
          action={{ label: 'New Opportunity', onClick: () => { setOppModal({ open: true, opp: null }) } }}
        />

        {opportunities.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total', value: String(opportunities.length) },
              { label: 'Est. ANP', value: formatCurrency(totalANP) },
              { label: 'Est. FYC', value: formatCurrency(totalFYC) },
              { label: 'Won FYC', value: formatCurrency(wonFYC) },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-4 text-center">
                <div className="text-base font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {opportunities.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
            <EmptyState icon={TrendingUp} message="No opportunities yet. Add one to start tracking this client's pipeline." />
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map(opp => {
              const stage = STAGE_CONFIG[opp.stage] ?? STAGE_CONFIG.new_lead
              return (
                <div
                  key={opp.id}
                  className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn('mt-1.5 h-2.5 w-2.5 rounded-full shrink-0', stage.dot)} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{opp.title}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', stage.badge)}>
                            {stage.label}
                          </span>
                          {opp.product_type && (
                            <span className="text-xs text-slate-500">
                              {opp.product_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          )}
                          {opp.probability != null && (
                            <span className="text-xs text-slate-400">{opp.probability}% likely</span>
                          )}
                        </div>
                        {opp.next_action && (
                          <p className="mt-1.5 text-xs text-slate-500">
                            <span className="font-medium">Next:</span> {opp.next_action}
                            {opp.next_action_date && (
                              <span className="ml-1 text-slate-400">· {formatDate(opp.next_action_date)}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        {opp.estimated_fyc != null && (
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(opp.estimated_fyc)}</div>
                        )}
                        {opp.estimated_anp != null && (
                          <div className="text-xs text-slate-500">ANP {formatCurrency(opp.estimated_anp)}</div>
                        )}
                        {opp.expected_close_date && (
                          <div className="text-xs text-slate-400 mt-0.5">{formatDate(opp.expected_close_date)}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setOppModal({ open: true, opp })}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'opp', id: opp.id, name: opp.title })}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderNotes = () => {
    const pinned = notes.filter(n => n.is_pinned)
    const unpinned = notes.filter(n => !n.is_pinned)

    const NoteCard = ({ note }: { note: Note }) => (
      <div className={cn(
        'rounded-xl bg-white border shadow-sm p-4 hover:shadow-md transition-shadow',
        note.is_pinned ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200/80'
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {note.title && (
              <h4 className="text-sm font-semibold text-slate-900 mb-1">{note.title}</h4>
            )}
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
              {note.content}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>{relativeTime(note.created_at)}</span>
              {note.meeting_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(note.meeting_date)}
                </span>
              )}
              {note.is_pinned && (
                <span className="text-indigo-500 font-medium">Pinned</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => togglePin(note)}
              title={note.is_pinned ? 'Unpin' : 'Pin'}
              className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              {note.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setNoteDrawer({ open: true, note })}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteTarget({ type: 'note', id: note.id, name: note.title ?? note.content.slice(0, 40) })}
              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <div>
        <SectionHeader
          title="Notes"
          count={notes.length}
          action={{ label: 'Add Note', icon: Plus, onClick: () => setNoteDrawer({ open: true, note: null }) }}
        />

        {notes.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
            <EmptyState icon={StickyNote} message="No notes yet. Add one to capture key information about this client." />
          </div>
        ) : (
          <div className="space-y-3">
            {pinned.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Pinned</p>
                {pinned.map(note => <NoteCard key={note.id} note={note} />)}
                {unpinned.length > 0 && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1 pt-2">All Notes</p>
                )}
              </>
            )}
            {unpinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        )}
      </div>
    )
  }

  const renderMeetings = () => (
    <div>
      <SectionHeader
        title="Meeting History"
        count={meetingActivities.length}
        action={{
          label: 'Log Meeting',
          onClick: () => setActDrawer({ open: true, activity: null, defaultType: 'meeting' }),
        }}
      />

      {meetingActivities.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <EmptyState icon={Video} message="No meetings logged yet. Log a meeting to keep track of interactions." />
        </div>
      ) : (
        <div className="relative space-y-0">
          {meetingActivities.map((activity, idx) => {
            const cfg = ACTIVITY_TYPE_CONFIG[activity.type] ?? ACTIVITY_TYPE_CONFIG.other
            const { Icon } = cfg
            return (
              <div key={activity.id} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={cn('mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {idx < meetingActivities.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1" />
                  )}
                </div>

                {/* Content */}
                <div className={cn('flex-1 pb-4', idx === meetingActivities.length - 1 ? '' : '')}>
                  <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-4 mt-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{activity.subject}</span>
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', STATUS_BADGE[activity.status] ?? STATUS_BADGE.planned)}>
                            {activity.status}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="mt-1 text-sm text-slate-600 line-clamp-3">{activity.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {activity.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(activity.scheduled_at)}
                            </span>
                          )}
                          {activity.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {activity.duration_minutes} min
                            </span>
                          )}
                          <span>{relativeTime(activity.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setActDrawer({ open: true, activity })}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'activity', id: activity.id, name: activity.subject })}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderTasks = () => {
    const pending = taskActivities.filter(a => a.status === 'planned' || a.status === 'rescheduled')
    const done = taskActivities.filter(a => a.status === 'completed' || a.status === 'cancelled')

    const TaskRow = ({ activity }: { activity: ActivityType }) => {
      const completed = activity.status === 'completed'
      return (
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-xl border shadow-sm bg-white hover:shadow-md transition-shadow',
          completed ? 'border-slate-100 opacity-60' : 'border-slate-200/80'
        )}>
          <button
            onClick={() => toggleActivity(activity)}
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              completed
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 hover:border-indigo-500'
            )}
          >
            {completed && <Check className="h-3 w-3" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-medium', completed ? 'line-through text-slate-400' : 'text-slate-900')}>
                {activity.subject}
              </span>
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', STATUS_BADGE[activity.status] ?? '')}>
                {activity.type.replace('_', ' ')}
              </span>
            </div>
            {activity.description && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{activity.description}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {activity.scheduled_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(activity.scheduled_at)}
                </span>
              )}
              <span>{relativeTime(activity.created_at)}</span>
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setActDrawer({ open: true, activity, defaultType: activity.type })}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteTarget({ type: 'activity', id: activity.id, name: activity.subject })}
              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <SectionHeader
          title="Follow-up Tasks"
          count={taskActivities.length}
          action={{
            label: 'Add Task',
            onClick: () => setActDrawer({ open: true, activity: null, defaultType: 'follow_up' }),
          }}
        />

        {taskActivities.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
            <EmptyState icon={CheckSquare} message="No tasks yet. Add a follow-up task to stay on top of this client." />
          </div>
        ) : (
          <div className="space-y-3">
            {pending.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
                  Open ({pending.length})
                </p>
                {pending.map(a => <TaskRow key={a.id} activity={a} />)}
              </>
            )}
            {done.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1 pt-3">
                  Completed ({done.length})
                </p>
                {done.map(a => <TaskRow key={a.id} activity={a} />)}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderFiles = () => (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Files</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {files.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadCategory}
            onChange={e => setUploadCategory(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="">No category</option>
            {FILE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-70 transition-colors"
          >
            {uploadingFile ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {files.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <EmptyState icon={FileIcon} message="No files uploaded yet. Upload KYC documents, proposals, or other files." />
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm divide-y divide-slate-50">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <FileIcon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {file.category && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {FILE_CATEGORY_LABELS[file.category] ?? file.category}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{formatFileSize(file.size_bytes)}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-400">{relativeTime(file.created_at)}</span>
                </div>
                {file.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{file.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => downloadFile(file)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderTimeline = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Activity Timeline</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {timelineItems.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNoteDrawer({ open: true, note: null })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Note
          </button>
          <button
            onClick={() => setActDrawer({ open: true, activity: null, defaultType: 'meeting' })}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Activity
          </button>
        </div>
      </div>

      {timelineItems.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <EmptyState icon={Activity} message="No activity recorded yet. Log meetings, calls, or notes to build a history." />
        </div>
      ) : (
        <div className="relative">
          {timelineItems.map((item, idx) => {
            const isActivity = item.kind === 'activity'
            const cfg = isActivity
              ? (ACTIVITY_TYPE_CONFIG[item.data.type] ?? ACTIVITY_TYPE_CONFIG.other)
              : { label: 'Note', Icon: StickyNote, color: 'text-amber-500' }
            const { Icon } = cfg
            const isLast = idx === timelineItems.length - 1

            return (
              <div key={`${item.kind}-${item.data.id}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm',
                    cfg.color
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
                </div>

                <div className="flex-1 pb-4">
                  <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-4 mt-2">
                    {isActivity ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {cfg.label}
                              </span>
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', STATUS_BADGE[item.data.status] ?? '')}>
                                {item.data.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{item.data.subject}</p>
                            {item.data.description && (
                              <p className="mt-1 text-sm text-slate-600 line-clamp-3">{item.data.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span>{relativeTime(item.date)}</span>
                              {item.data.duration_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {item.data.duration_minutes} min
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setActDrawer({ open: true, activity: item.data, defaultType: item.data.type })}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ type: 'activity', id: item.data.id, name: item.data.subject })}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">Note</span>
                          {item.data.is_pinned && (
                            <span className="text-xs text-indigo-500 font-medium">Pinned</span>
                          )}
                        </div>
                        {item.data.title && (
                          <p className="mt-1 text-sm font-semibold text-slate-900">{item.data.title}</p>
                        )}
                        <p className="mt-1 text-sm text-slate-600 line-clamp-3">{item.data.content}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                          <span>{relativeTime(item.date)}</span>
                          {item.data.meeting_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(item.data.meeting_date)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-slate-50">

      {/* Top nav */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm px-6 py-3">
        <Link
          href="/clients"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-sm font-medium text-slate-700 truncate">{client.full_name}</span>
        <div className="ml-auto">
          <button
            onClick={() => setEditDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Client
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="h-28 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600" />
        <div className="mx-auto max-w-6xl px-6 pb-5">
          <div className="-mt-12 mb-3 flex items-end justify-between">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-lg ring-4 ring-white overflow-hidden">
              {client.profile_photo_url ? (
                <img src={client.profile_photo_url} alt={client.full_name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-slate-600">{getInitials(client.full_name)}</span>
              )}
            </div>
            <StatusBadge value={client.status} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{client.full_name}</h1>
          {client.preferred_name && (
            <p className="text-sm text-slate-500 mt-0.5">Goes by {client.preferred_name}</p>
          )}

          {/* Quick contact */}
          <div className="mt-3 flex flex-wrap gap-4">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                <Mail className="h-4 w-4 shrink-0" />
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                <Phone className="h-4 w-4 shrink-0" />
                {client.phone}
              </a>
            )}
            {client.address && (
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" />
                {client.address}
              </span>
            )}
            {(client.occupation || client.company) && (
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <Briefcase className="h-4 w-4 shrink-0" />
                {[client.occupation, client.company].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    borderColor: tag.color + '40',
                    backgroundColor: tag.color + '15',
                    color: tag.color,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4">
            <div>
              <div className="text-lg font-bold text-slate-900">{opportunities.length}</div>
              <div className="text-xs text-slate-500">Opportunities</div>
            </div>
            {totalFYC > 0 && (
              <div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(totalFYC, true)}</div>
                <div className="text-xs text-slate-500">Est. FYC</div>
              </div>
            )}
            {totalANP > 0 && (
              <div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(totalANP, true)}</div>
                <div className="text-xs text-slate-500">Est. ANP</div>
              </div>
            )}
            <div>
              <div className="text-lg font-bold text-slate-900">{notes.length}</div>
              <div className="text-xs text-slate-500">Notes</div>
            </div>
            {openTaskCount > 0 && (
              <div>
                <div className="text-lg font-bold text-amber-600">{openTaskCount}</div>
                <div className="text-xs text-slate-500">Open Tasks</div>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-900">{formatDate(client.created_at)}</div>
              <div className="text-xs text-slate-500">Client Since</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-[49px] z-10 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                )}
              >
                {tab.label}
                {tab.id === 'tasks' && openTaskCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {openTaskCount}
                  </span>
                )}
                {tab.id === 'pipeline' && opportunities.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                    {opportunities.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {activeTab === 'overview'  && renderOverview()}
        {activeTab === 'pipeline'  && renderPipeline()}
        {activeTab === 'notes'     && renderNotes()}
        {activeTab === 'meetings'  && renderMeetings()}
        {activeTab === 'tasks'     && renderTasks()}
        {activeTab === 'files'     && renderFiles()}
        {activeTab === 'timeline'  && renderTimeline()}
        {activeTab === 'coverage'  && (
          <CoverageChecklist
            initialItems={initialChecklist}
            clientId={client.id}
            userId={userId}
          />
        )}
      </div>

      {/* ── Drawers & Modals ── */}
      <ClientFormDrawer
        open={editDrawerOpen}
        mode="edit"
        client={client}
        allTags={allTags}
        userId={userId}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={async () => {
          setEditDrawerOpen(false)
          const { data } = await db
            .from('clients')
            .select('*, client_tags(tags(*))')
            .eq('id', client.id)
            .single()
          if (data) {
            const newTags = ((data.client_tags ?? []) as Array<{ tags: Tag | null }>)
              .map(ct => ct.tags)
              .filter((t): t is Tag => t !== null)
            setClient(data as unknown as Client)
            setTags(newTags)
          }
        }}
      />

      <NoteDrawer
        open={noteDrawer.open}
        note={noteDrawer.note}
        clientId={client.id}
        userId={userId}
        onClose={() => setNoteDrawer({ open: false })}
        onSaved={async () => { setNoteDrawer({ open: false }); await refetchNotes() }}
      />

      <ActivityDrawer
        open={actDrawer.open}
        activity={actDrawer.activity}
        clientId={client.id}
        userId={userId}
        defaultType={actDrawer.defaultType}
        onClose={() => setActDrawer({ open: false })}
        onSaved={async () => { setActDrawer({ open: false }); await refetchActivities() }}
      />

      <OpportunityModal
        open={oppModal.open}
        opportunity={oppModal.opp}
        clientId={client.id}
        userId={userId}
        onClose={() => setOppModal({ open: false })}
        onSaved={async () => { setOppModal({ open: false }); await refetchOpps() }}
      />

      {deleteTarget && (
        <DeleteModal
          title={`Delete ${deleteTarget.type}`}
          description={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
