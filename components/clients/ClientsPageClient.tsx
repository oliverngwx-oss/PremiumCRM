'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, SlidersHorizontal, Trash2, Eye,
  Pencil, ChevronUp, ChevronDown, ChevronsUpDown,
  X, CheckSquare, Square, Users, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, getInitials } from '@/lib/utils'
import type { Client, Tag } from '@/types/database'
import ClientFormDrawer from './ClientFormDrawer'
import DeleteModal from './DeleteModal'
import StatusBadge from './StatusBadge'
import AIFilterPanel from './AIFilterPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientWithTags = Client & {
  client_tags?: Array<{ tags: Tag | null }>
}

type SortField = 'full_name' | 'age' | 'address' | 'occupation' | 'company' | 'created_at'

interface Filters {
  status:     string[]
  source:     string[]
  clientType: string[]
  tagIds:     string[]
}

const EMPTY_FILTERS: Filters = { status: [], source: [], clientType: [], tagIds: [] }

// ─── Sort header cell ─────────────────────────────────────────────────────────

function SortTh({
  field, label, current, dir, onClick, className,
}: {
  field: SortField; label: string; current: SortField; dir: 'asc' | 'desc';
  onClick: (f: SortField) => void; className?: string
}) {
  const active = current === field
  return (
    <th
      className={cn('px-4 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-900 transition-colors whitespace-nowrap', className)}
      onClick={() => onClick(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === 'asc'
            ? <ChevronUp className="h-3 w-3 text-indigo-500" />
            : <ChevronDown className="h-3 w-3 text-indigo-500" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-indigo-700">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-indigo-900">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ClientsPageClientProps {
  initialClients: ClientWithTags[]
  allTags: Tag[]
  userId: string
}

export default function ClientsPageClient({
  initialClients, allTags, userId,
}: ClientsPageClientProps) {
  const router = useRouter()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientWithTags[]>(initialClients)
  const [loading, setLoading] = useState(false)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Form drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add')
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // AI filter panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    let res = [...clients]

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      res = res.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.preferred_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.occupation?.toLowerCase().includes(q)
      )
    }

    if (filters.status.length)     res = res.filter(c => filters.status.includes(c.status))
    if (filters.source.length)     res = res.filter(c => c.source != null && filters.source.includes(c.source))
    if (filters.clientType.length) res = res.filter(c => c.client_type != null && filters.clientType.includes(c.client_type))
    if (filters.tagIds.length)     res = res.filter(c =>
      c.client_tags?.some(ct => ct.tags && filters.tagIds.includes(ct.tags.id))
    )

    res.sort((a, b) => {
      const av = (a[sortField] ?? '') as string
      const bv = (b[sortField] ?? '') as string
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })

    return res
  }, [clients, searchTerm, filters, sortField, sortDir])

  const activeFilterCount = filters.status.length + filters.source.length + filters.clientType.length + filters.tagIds.length
  const allSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id))
  const someSelected = selectedIds.size > 0

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('*, client_tags(tags(*))')
      .order('created_at', { ascending: false })
    if (data) setClients(data as ClientWithTags[])
    setLoading(false)
  }, [])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)))
    }
  }

  function toggleFilter<K extends keyof Filters>(key: K, value: string) {
    setFilters(prev => {
      const list = prev[key] as string[]
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      }
    })
  }

  function openAdd() {
    setEditingClient(null)
    setDrawerMode('add')
    setDrawerOpen(true)
  }

  function openEdit(client: ClientWithTags) {
    setEditingClient(client)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  function confirmDelete(id: string) {
    setDeleteId(id)
    setDeleteTarget('single')
  }

  function confirmBulkDelete() {
    setDeleteTarget('bulk')
  }

  async function handleDelete() {
    setDeleteLoading(true)
    const supabase = createClient()

    if (deleteTarget === 'single' && deleteId) {
      await supabase.from('clients').delete().eq('id', deleteId)
      setClients(prev => prev.filter(c => c.id !== deleteId))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteId); return n })
    } else if (deleteTarget === 'bulk') {
      const ids = [...selectedIds]
      await supabase.from('clients').delete().in('id', ids)
      setClients(prev => prev.filter(c => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
    }

    setDeleteTarget(null)
    setDeleteId(null)
    setDeleteLoading(false)
  }

  async function handleFormSuccess(refresh?: boolean) {
    setDrawerOpen(false)
    setEditingClient(null)
    if (refresh) await refetch()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-6 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search clients…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* AI Search */}
          <button
            onClick={() => setAiPanelOpen(v => !v)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              aiPanelOpen
                ? 'border-violet-300 bg-violet-50 text-violet-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI Search
          </button>

          {/* Bulk delete */}
          {someSelected && (
            <button
              onClick={confirmBulkDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedIds.size}
            </button>
          )}

          <div className="ml-auto">
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </button>
          </div>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {filters.status.map(v => (
              <FilterPill key={v} label={`Status: ${v}`} onRemove={() => toggleFilter('status', v)} />
            ))}
            {filters.source.map(v => (
              <FilterPill key={v} label={`Source: ${v}`} onRemove={() => toggleFilter('source', v)} />
            ))}
            {filters.clientType.map(v => (
              <FilterPill key={v} label={`Type: ${v}`} onRemove={() => toggleFilter('clientType', v)} />
            ))}
            {filters.tagIds.map(id => {
              const tag = allTags.find(t => t.id === id)
              return tag ? (
                <FilterPill key={id} label={`Tag: ${tag.name}`} onRemove={() => toggleFilter('tagIds', id)} />
              ) : null
            })}
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs text-slate-400 hover:text-slate-700 px-1 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── AI Filter panel ─────────────────────────────────────────────────── */}
      {aiPanelOpen && (
        <div className="shrink-0 border-b border-violet-200 bg-white shadow-md" style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <AIFilterPanel onClose={() => setAiPanelOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Filter panel ──────────────────────────────────────────────────── */}
        {showFilters && (
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Filters</h3>
              <button onClick={() => setShowFilters(false)}>
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            {/* Status */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">Status</p>
              {(['prospect', 'active', 'vip', 'inactive', 'lost'] as const).map(s => (
                <label key={s} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={filters.status.includes(s)}
                    onChange={() => toggleFilter('status', s)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>

            {/* Client Type */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">Client Type</p>
              {(['prospect', 'active', 'vip', 'referral', 'inactive', 'former'] as const).map(s => (
                <label key={s} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={filters.clientType.includes(s)}
                    onChange={() => toggleFilter('clientType', s)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>

            {/* Source */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">Source</p>
              {([
                ['referral', 'Referral'], ['cold_call', 'Cold Call'],
                ['social_media', 'Social Media'], ['event', 'Event'],
                ['website', 'Website'], ['existing_client', 'Existing Client'],
                ['walk_in', 'Walk-in'], ['other', 'Other'],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={filters.source.includes(val)}
                    onChange={() => toggleFilter('source', val)}
                    className="h-3.5 w-3.5 accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">Tags</p>
                {allTags.map(tag => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600 hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={filters.tagIds.includes(tag.id)}
                      onChange={() => toggleFilter('tagIds', tag.id)}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </label>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Users className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-base font-medium text-slate-700">
                {clients.length === 0 ? 'No clients yet' : 'No results found'}
              </p>
              <p className="mt-1 text-sm text-slate-400 max-w-xs">
                {clients.length === 0
                  ? 'Add your first client to get started with the CRM.'
                  : 'Try adjusting your search or filters.'}
              </p>
              {clients.length === 0 && (
                <button
                  onClick={openAdd}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add First Client
                </button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {allSelected
                        ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <SortTh field="full_name"  label="Client"     current={sortField} dir={sortDir} onClick={toggleSort} className="min-w-[200px]" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">Status</th>
                  <SortTh field="company"    label="Company"    current={sortField} dir={sortDir} onClick={toggleSort} />
                  <SortTh field="occupation" label="Occupation" current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Source</th>
                  <SortTh field="created_at" label="Added"      current={sortField} dir={sortDir} onClick={toggleSort} />
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredClients.map(client => {
                  const tags = client.client_tags?.map(ct => ct.tags).filter(Boolean) as Tag[] ?? []
                  const initials = getInitials(client.full_name)
                  const selected = selectedIds.has(client.id)

                  return (
                    <tr
                      key={client.id}
                      className={cn(
                        'group transition-colors hover:bg-slate-50/70',
                        selected && 'bg-indigo-50/40'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(client.id)}
                          className="text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                          {selected
                            ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                            : <Square className="h-4 w-4" />}
                        </button>
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 overflow-hidden">
                            {client.profile_photo_url ? (
                              <img src={client.profile_photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">{initials}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {client.preferred_name ?? client.full_name}
                            </p>
                            {client.email && (
                              <p className="text-xs text-slate-400 truncate">{client.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge value={client.status} size="sm" />
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3 text-slate-600 max-w-[140px]">
                        <span className="block truncate">{client.company ?? '—'}</span>
                      </td>

                      {/* Occupation */}
                      <td className="px-4 py-3 text-slate-600 max-w-[140px]">
                        <span className="block truncate">{client.occupation ?? '—'}</span>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {client.phone ?? '—'}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap capitalize text-xs">
                        {client.source?.replace(/_/g, ' ') ?? '—'}
                      </td>

                      {/* Added */}
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(client.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/clients/${client.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => openEdit(client)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(client.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200/80 bg-white px-6 py-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {loading ? 'Refreshing…' : `${filteredClients.length} of ${clients.length} client${clients.length !== 1 ? 's' : ''}`}
          {someSelected && ` · ${selectedIds.size} selected`}
        </p>
        {activeFilterCount > 0 && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Form Drawer ───────────────────────────────────────────────────────── */}
      <ClientFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        client={editingClient}
        allTags={allTags}
        userId={userId}
        onSuccess={handleFormSuccess}
        onClose={() => { setDrawerOpen(false); setEditingClient(null) }}
      />

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          title={deleteTarget === 'bulk' ? `Delete ${selectedIds.size} clients?` : 'Delete client?'}
          description={
            deleteTarget === 'bulk'
              ? `This will permanently delete ${selectedIds.size} selected clients and all their associated data.`
              : 'This will permanently delete this client and all their associated data. This cannot be undone.'
          }
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteId(null) }}
        />
      )}
    </div>
  )
}
