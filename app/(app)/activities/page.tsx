import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  PhoneCall, Video, Mail, ClipboardList, Activity,
  CheckSquare, Bell, Circle, Calendar, Clock,
} from 'lucide-react'
import { cn, formatDateTime, formatDate, relativeTime } from '@/lib/utils'
import type { ActivityWithClient } from '@/types/database'

export const metadata: Metadata = { title: 'Activities' }

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string; dot: string }> = {
  meeting:      { label: 'Meeting',      Icon: Video,          color: 'text-indigo-500',  dot: 'bg-indigo-400' },
  call:         { label: 'Call',         Icon: PhoneCall,      color: 'text-emerald-500', dot: 'bg-emerald-400' },
  email:        { label: 'Email',        Icon: Mail,           color: 'text-sky-500',     dot: 'bg-sky-400' },
  presentation: { label: 'Presentation', Icon: ClipboardList,  color: 'text-violet-500',  dot: 'bg-violet-400' },
  review:       { label: 'Review',       Icon: Activity,       color: 'text-orange-500',  dot: 'bg-orange-400' },
  task:         { label: 'Task',         Icon: CheckSquare,    color: 'text-slate-500',   dot: 'bg-slate-400' },
  follow_up:    { label: 'Follow-up',    Icon: Bell,           color: 'text-amber-500',   dot: 'bg-amber-400' },
  other:        { label: 'Other',        Icon: Circle,         color: 'text-slate-400',   dot: 'bg-slate-300' },
}

const STATUS_BADGE: Record<string, string> = {
  planned:     'bg-blue-50 text-blue-700 border-blue-200',
  completed:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:   'bg-red-50 text-red-500 border-red-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: activities } = await db
    .from('activities')
    .select('*, client:clients(id, full_name, preferred_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (activities ?? []) as ActivityWithClient[]

  const upcoming = rows.filter(a => a.status === 'planned' || a.status === 'rescheduled')
  const completed = rows.filter(a => a.status === 'completed')
  const cancelled = rows.filter(a => a.status === 'cancelled')

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5">
        <h1 className="text-xl font-bold text-slate-900">Activities</h1>
        <p className="text-sm text-slate-500 mt-0.5">All meetings, calls, tasks and follow-ups across your clients</p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">

        {rows.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-600">No activities yet</p>
            <p className="text-xs text-slate-400 mt-1">Activities logged on client profiles will appear here.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <Section title="Upcoming & Planned" count={upcoming.length} activities={upcoming} />
        )}
        {completed.length > 0 && (
          <Section title="Completed" count={completed.length} activities={completed} />
        )}
        {cancelled.length > 0 && (
          <Section title="Cancelled / Rescheduled" count={cancelled.length} activities={cancelled} />
        )}
      </div>
    </div>
  )
}

function Section({ title, count, activities }: {
  title: string
  count: number
  activities: ActivityWithClient[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
      </div>
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm divide-y divide-slate-50">
        {activities.map(activity => {
          const cfg = ACTIVITY_TYPE_CONFIG[activity.type] ?? ACTIVITY_TYPE_CONFIG.other
          const { Icon } = cfg
          const clientName = activity.client?.preferred_name ?? activity.client?.full_name
          const isOverdue = activity.status === 'planned'
            && activity.scheduled_at
            && new Date(activity.scheduled_at) < new Date()

          return (
            <div key={activity.id} className="flex items-start gap-4 px-4 py-4 hover:bg-slate-50/60 transition-colors">
              <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 border border-slate-100', cfg.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{activity.subject}</span>
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize', STATUS_BADGE[activity.status] ?? '')}>
                    {activity.status.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {cfg.label}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      Overdue
                    </span>
                  )}
                </div>
                {activity.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{activity.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {clientName && activity.client && (
                    <Link
                      href={`/clients/${activity.client.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {clientName}
                    </Link>
                  )}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
