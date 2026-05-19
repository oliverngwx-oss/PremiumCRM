import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Color = 'blue' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: Color
  change?: number
  changeLabel?: string
  subtitle?: string
}

const colorMap: Record<Color, { bg: string; icon: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700' },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700' },
}

export default function MetricCard({
  title, value, icon: Icon, color = 'indigo', change, changeLabel, subtitle,
}: MetricCardProps) {
  const c = colorMap[color]

  return (
    <div className="card-hover rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.bg)}>
          <Icon className={cn('h-5 w-5', c.icon)} />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            change > 0 ? 'bg-emerald-50 text-emerald-700'
            : change < 0 ? 'bg-red-50 text-red-600'
            : 'bg-slate-100 text-slate-500'
          )}>
            {change > 0
              ? <TrendingUp className="h-3 w-3" />
              : change < 0
              ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums leading-none">{value}</p>
        {(subtitle || changeLabel) && (
          <p className="mt-1.5 text-xs text-slate-400">
            {subtitle ?? changeLabel}
          </p>
        )}
      </div>
    </div>
  )
}
