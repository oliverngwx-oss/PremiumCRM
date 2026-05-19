import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { StickyNote, Pin, Calendar } from 'lucide-react'
import { cn, formatDate, relativeTime } from '@/lib/utils'
import type { NoteWithClient } from '@/types/database'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: notes } = await db
    .from('notes')
    .select('*, client:clients(id, full_name, preferred_name)')
    .eq('user_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = (notes ?? []) as NoteWithClient[]
  const pinned   = rows.filter(n => n.is_pinned)
  const unpinned = rows.filter(n => !n.is_pinned)

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5">
        <h1 className="text-xl font-bold text-slate-900">Notes</h1>
        <p className="text-sm text-slate-500 mt-0.5">All notes across your clients</p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">

        {rows.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <StickyNote className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-600">No notes yet</p>
            <p className="text-xs text-slate-400 mt-1">Notes added on client profiles will appear here.</p>
          </div>
        )}

        {pinned.length > 0 && (
          <NoteSection title="Pinned" count={pinned.length} notes={pinned} />
        )}
        {unpinned.length > 0 && (
          <NoteSection title="All Notes" count={unpinned.length} notes={unpinned} />
        )}
      </div>
    </div>
  )
}

function NoteSection({ title, count, notes }: {
  title: string
  count: number
  notes: NoteWithClient[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>
      </div>
      <div className="space-y-3">
        {notes.map(note => {
          const clientName = note.client?.preferred_name ?? note.client?.full_name
          return (
            <div
              key={note.id}
              className={cn(
                'rounded-xl bg-white border shadow-sm p-4',
                note.is_pinned ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200/80'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {note.title && (
                      <span className="text-sm font-semibold text-slate-900">{note.title}</span>
                    )}
                    {note.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                    {note.content}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {clientName && note.client && (
                      <Link
                        href={`/clients/${note.client.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        {clientName}
                      </Link>
                    )}
                    <span>{relativeTime(note.created_at)}</span>
                    {note.meeting_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(note.meeting_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
