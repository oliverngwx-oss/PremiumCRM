import { Calendar, Clock, Phone, Mail, Users, ChevronRight } from 'lucide-react'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import type { Activity } from '@/types/database'

type ActivityWithClient = Activity & {
  clients: { full_name: string; preferred_name: string | null } | null
}

interface UpcomingFollowupsProps {
  activities: ActivityWithClient[]
}

const typeConfig: Record<string, { icon: typeof Phone; color: string }> = {
  call:         { icon: Phone,    color: 'text-blue-500 bg-blue-50' },
  email:        { icon: Mail,     color: 'text-indigo-500 bg-indigo-50' },
  meeting:      { icon: Users,    color: 'text-violet-500 bg-violet-50' },
  follow_up:    { icon: Clock,    color: 'text-amber-500 bg-amber-50' },
  task:         { icon: Calendar, color: 'text-slate-500 bg-slate-100' },
  presentation: { icon: Users,    color: 'text-emerald-500 bg-emerald-50' },
  review:       { icon: Calendar, color: 'text-rose-500 bg-rose-50' },
  other:        { icon: Calendar, color: 'text-slate-500 bg-slate-100' },
}

function urgencyLabel(scheduledAt: string | null): { label: string; color: string } | null {
  if (!scheduledAt) return null
  const diff = new Date(scheduledAt).getTime() - Date.now()
  const hours = diff / 3_600_000
  if (hours < 0) return { label: 'Overdue', color: 'text-red-600 bg-red-50' }
  if (hours < 2) return { label: 'Soon', color: 'text-amber-600 bg-amber-50' }
  if (hours < 24) return { label: 'Today', color: 'text-indigo-600 bg-indigo-50' }
  return null
}

export default function UpcomingFollowups({ activities }: UpcomingFollowupsProps) {
  return (
    <div className="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Upcoming Follow-ups</h3>
          <p className="text-xs text-slate-400 mt-0.5">Scheduled activities</p>
        </div>
        <a href="/activities" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center py-6">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Calendar className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No upcoming activities</p>
          <a href="/activities" className="mt-2 text-xs font-medium text-indigo-600 hover:underline">
            Schedule one →
          </a>
        </div>
      ) : (
        <ul className="space-y-2 flex-1 overflow-y-auto">
          {activities.map(activity => {
            const config = typeConfig[activity.type] ?? typeConfig.other
            const Icon = config.icon
            const clientName = activity.clients?.preferred_name ?? activity.clients?.full_name
            const urgency = urgencyLabel(activity.scheduled_at)

            return (
              <li key={activity.id} className="group flex items-start gap-3 rounded-lg p-2.5 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5', config.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{activity.subject}</p>
                    {urgency && (
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', urgency.color)}>
                        {urgency.label}
                      </span>
                    )}
                  </div>
                  {clientName && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{clientName}</p>
                  )}
                  {activity.scheduled_at && (
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(activity.scheduled_at)}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
