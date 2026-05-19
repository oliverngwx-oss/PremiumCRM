import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { FolderOpen, File as FileIcon } from 'lucide-react'
import { relativeTime } from '@/lib/utils'
import type { UploadedFile } from '@/types/database'

export const metadata: Metadata = { title: 'Files' }

const FILE_CATEGORY_LABELS: Record<string, string> = {
  kyc: 'KYC', proposal: 'Proposal', policy: 'Policy',
  id_document: 'ID Document', financial_statement: 'Financial',
  correspondence: 'Correspondence', other: 'Other',
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileWithClient extends UploadedFile {
  client: { id: string; full_name: string; preferred_name: string | null } | null
}

export default async function FilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any

  const { data: files } = await db
    .from('uploaded_files')
    .select('*, client:clients(id, full_name, preferred_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (files ?? []) as FileWithClient[]

  // Group by category
  const grouped: Record<string, FileWithClient[]> = {}
  for (const file of rows) {
    const key = file.category ?? 'other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(file)
  }

  const categoryOrder = ['kyc', 'id_document', 'policy', 'proposal', 'financial_statement', 'correspondence', 'other']
  const sortedGroups = categoryOrder
    .filter(k => grouped[k]?.length)
    .map(k => ({ key: k, label: FILE_CATEGORY_LABELS[k] ?? k, files: grouped[k] }))

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Files</h1>
            <p className="text-sm text-slate-500 mt-0.5">All documents uploaded across your clients</p>
          </div>
          {rows.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              {rows.length} file{rows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">

        {rows.length === 0 && (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-600">No files yet</p>
            <p className="text-xs text-slate-400 mt-1">Files uploaded on client profiles will appear here.</p>
          </div>
        )}

        {sortedGroups.map(group => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{group.label}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {group.files.length}
              </span>
            </div>
            <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm divide-y divide-slate-50">
              {group.files.map(file => {
                const clientName = file.client?.preferred_name ?? file.client?.full_name
                return (
                  <div key={file.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <FileIcon className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {clientName && file.client && (
                          <Link
                            href={`/clients/${file.client.id}`}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            {clientName}
                          </Link>
                        )}
                        <span className="text-xs text-slate-400">{formatFileSize(file.size_bytes)}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{relativeTime(file.created_at)}</span>
                      </div>
                      {file.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{file.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
