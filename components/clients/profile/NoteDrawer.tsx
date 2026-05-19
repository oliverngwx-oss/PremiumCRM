'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Note } from '@/types/database'

const schema = z.object({
  title:        z.string().optional().or(z.literal('')),
  content:      z.string().min(1, 'Content is required'),
  meeting_date: z.string().optional().or(z.literal('')),
  is_pinned:    z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  note?: Note | null
  clientId: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

export default function NoteDrawer({ open, note, clientId, userId, onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '', meeting_date: '', is_pinned: false },
  })

  useEffect(() => {
    if (!open) return
    if (note) {
      reset({
        title:        note.title ?? '',
        content:      note.content,
        meeting_date: note.meeting_date ?? '',
        is_pinned:    note.is_pinned,
      })
    } else {
      reset({ title: '', content: '', meeting_date: '', is_pinned: false })
    }
  }, [open, note?.id])

  async function onSubmit(values: FormValues) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const payload = {
      title:        values.title || null,
      content:      values.content,
      meeting_date: values.meeting_date || null,
      is_pinned:    values.is_pinned,
      client_id:    clientId,
      user_id:      userId,
    }
    if (note) {
      const { error } = await db.from('notes').update(payload).eq('id', note.id)
      if (error) throw error
    } else {
      const { error } = await db.from('notes').insert(payload)
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
            {note ? 'Edit Note' : 'Add Note'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Title <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              {...register('title')}
              className={inputCls}
              placeholder="Meeting summary, call notes…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              {...register('content')}
              rows={10}
              className={`${inputCls} resize-none`}
              placeholder="Write your note here…"
            />
            {errors.content && (
              <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Meeting Date <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="date" {...register('meeting_date')} className={inputCls} />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              {...register('is_pinned')}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
              Pin this note to the top
            </span>
          </label>
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
            {note ? 'Save Changes' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
