'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Activity, ActivityType } from '@/types/database'

const schema = z.object({
  type:             z.string().min(1),
  subject:          z.string().min(1, 'Subject is required'),
  description:      z.string().optional().or(z.literal('')),
  status:           z.string().min(1),
  scheduled_at:     z.string().optional().or(z.literal('')),
  completed_at:     z.string().optional().or(z.literal('')),
  duration_minutes: z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  activity?: Activity | null
  clientId: string
  userId: string
  defaultType?: ActivityType
  onClose: () => void
  onSaved: () => void
}

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'meeting',      label: 'Meeting' },
  { value: 'call',         label: 'Phone Call' },
  { value: 'email',        label: 'Email' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'review',       label: 'Review' },
  { value: 'task',         label: 'Task' },
  { value: 'follow_up',    label: 'Follow-up' },
  { value: 'other',        label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'planned',     label: 'Planned' },
  { value: 'completed',   label: 'Completed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'cancelled',   label: 'Cancelled' },
]

export default function ActivityDrawer({
  open, activity, clientId, userId, defaultType = 'meeting', onClose, onSaved,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaultType, subject: '', description: '',
      status: 'planned', scheduled_at: '', completed_at: '', duration_minutes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (activity) {
      reset({
        type:             activity.type,
        subject:          activity.subject,
        description:      activity.description ?? '',
        status:           activity.status,
        scheduled_at:     activity.scheduled_at ? activity.scheduled_at.slice(0, 16) : '',
        completed_at:     activity.completed_at ? activity.completed_at.slice(0, 16) : '',
        duration_minutes: activity.duration_minutes != null ? String(activity.duration_minutes) : '',
      })
    } else {
      reset({
        type: defaultType, subject: '', description: '',
        status: 'planned', scheduled_at: '', completed_at: '', duration_minutes: '',
      })
    }
  }, [open, activity?.id, defaultType])

  async function onSubmit(values: FormValues) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const payload = {
      type:             values.type as Activity['type'],
      subject:          values.subject,
      description:      values.description || null,
      status:           values.status as Activity['status'],
      scheduled_at:     values.scheduled_at || null,
      completed_at:     values.completed_at || null,
      duration_minutes: values.duration_minutes ? parseInt(values.duration_minutes) : null,
      client_id:        clientId,
      user_id:          userId,
    }
    if (activity) {
      const { error } = await db.from('activities').update(payload).eq('id', activity.id)
      if (error) throw error
    } else {
      const { error } = await db.from('activities').insert(payload)
      if (error) throw error
    }
    onSaved()
  }

  if (!open) return null

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {activity ? 'Edit Activity' : 'Log Activity'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
              <select {...register('type')} className={inputCls}>
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
              <select {...register('status')} className={inputCls}>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              {...register('subject')}
              className={inputCls}
              placeholder="What was this about?"
            />
            {errors.subject && (
              <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Notes, outcomes, follow-up items…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Scheduled At</label>
            <input type="datetime-local" {...register('scheduled_at')} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Completed At</label>
              <input type="datetime-local" {...register('completed_at')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration (min)</label>
              <input
                type="number"
                {...register('duration_minutes')}
                className={inputCls}
                placeholder="30"
                min="0"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70 transition-colors"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {activity ? 'Save Changes' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}
