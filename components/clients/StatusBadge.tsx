import { cn } from '@/lib/utils'
import type { ClientStatus, ClientType } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  prospect:  { label: 'Prospect',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  active:    { label: 'Active',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive:  { label: 'Inactive',  classes: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost:      { label: 'Lost',      classes: 'bg-red-50 text-red-600 border-red-200' },
  vip:       { label: 'VIP',       classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  referral:  { label: 'Referral',  classes: 'bg-violet-50 text-violet-700 border-violet-200' },
  former:    { label: 'Former',    classes: 'bg-slate-100 text-slate-400 border-slate-200' },
}

interface StatusBadgeProps {
  value: string | null | undefined
  size?: 'sm' | 'md'
}

export default function StatusBadge({ value, size = 'md' }: StatusBadgeProps) {
  if (!value) return null
  const cfg = STATUS_CONFIG[value] ?? { label: value, classes: 'bg-slate-100 text-slate-500 border-slate-200' }
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium leading-none',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      cfg.classes
    )}>
      {cfg.label}
    </span>
  )
}
