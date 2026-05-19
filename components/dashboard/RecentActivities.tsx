import {
  Phone, Mail, Users, Calendar, CheckCircle2,
  XCircle, Clock, ChevronRight, Activity,
} from 'lucide-react'
import { cn, relativeTime, getInitials } from '@/lib/utils'
import type { ActivityType, ActivityStatus } from '@/types/database'

type ActivityRow = {
  id: string
  type: ActivityType
  subject: string
  description: string | null
  status: ActivityStatus
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
  clients: { full_name: string; preferred_name: string | null } | null
}

interface RecentActivitiesProps {
  activities: ActivityRow[]
}

const typeConfig: Record<ActivityType, { icon: typeof Phone; label: string }> = {
  call:         { icon: Phone,    label: 'Call' },
  email:        { icon: Mail,     label: 'Email' },
  meeting:      { icon: Users,    label: 'Meeting' },
  task:         { icon: Calendar, label: 'Task' },
  follow_up:    { icon: Clock,    label: 'Follow-up' },
  presentation: { icon: Users,    label: 'Presentation' },
  review:       { icon: Calendar, label: 'Review' },
  other:        { icon: Activity, label: 'Other' },
}

const statusConfig: Record<ActivityStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed:   { icon: CheckCircle2, color: 'text-emerald-500', label: 'Completed' },
  planned:     { icon: Clock,        color: 'text-indigo-500',  label: 'Planned' },
  cancelled:   { icon: XCircle,      color: 'text-red-400',     label: 'Cancelled' },
  rescheduled: { icon: Clock,        color: 'text-amber-500',   label: 'Rescheduled' },
}

export default function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Recent Activities</h3>
          <p className="text-xs text-slate-400 mt-0.5">Latest logged interactions</p>
        </div>
        <a href="/activities" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Activity className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No activities yet</p>
          <a href="/activities" className="mt-2 text-xs font-medium text-indigo-600 hover:underline">
            Log your first activity →
          </a>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {activities.map((activity, i) => {
            const type = typeConfig[activity.type] ?? typeConfig.other
            const status = statusConfig[activity.status] ?? statusConfig.planned
            const TypeIcon = type.icon
            const StatusIcon = status.icon
            const clientName = activity.clients?.preferred_name ?? activity.clients?.full_name

            return (
              <div
                key={activity.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors group cursor-pointer"
              >
                {/* Timeline dot */}
                <div className="relative flex shrink-0 flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition-colors">
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  {i < activities.length - 1 && (
                    <div className="absolute top-9 w-px h-full bg-slate-100" style={{ top: '36px', height: 'calc(100% + 14px)' }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800 truncate">{activity.subject}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium shrink-0">
                      {type.label}
                    </span>
                  </div>
                  {clientName && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      With {clientName}
                    </p>
                  )}
                  {activity.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{activity.description}</p>
                  )}
                </div>

                {/* Right side */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <div className={cn('flex items-center gap-1 text-[10px] font-medium', status.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {relativeTime(activity.completed_at ?? activity.scheduled_at ?? activity.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
