'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  Sparkles, Send, X, Loader2, RotateCcw, ExternalLink,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { ClientFilterResult } from '@/app/api/ai-filter-clients/route'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Show me clients above age 50',
  'Find prospects with no follow-up in 30 days',
  'Show prospects with estimated FYC above 3,000',
  'Find clients who are married with children',
  'Show me all nurses or teachers',
  'Find warm prospects not contacted in 30 days',
  'Show active VIP clients',
  'Find referral clients',
]

const STATUS_STYLES: Record<string, string> = {
  prospect:  'bg-indigo-50 text-indigo-700 border border-indigo-200',
  active:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  vip:       'bg-amber-50 text-amber-700 border border-amber-200',
  inactive:  'bg-slate-100 text-slate-500 border border-slate-200',
  lost:      'bg-red-50 text-red-600 border border-red-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
      {status}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
      {getInitials(name)}
    </div>
  )
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d   = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 0)  return formatDate(dateStr)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return formatDate(dateStr)
}

function futureDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d   = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0)  return 'Overdue'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7)  return `In ${diffDays}d`
  return formatDate(dateStr)
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AIFilterPanelProps {
  onClose: () => void
}

export default function AIFilterPanel({ onClose }: AIFilterPanelProps) {
  const [query,       setQuery]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [clients,     setClients]     = useState<ClientFilterResult[] | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [rawFilters,  setRawFilters]  = useState<Record<string, unknown> | null>(null)

  const inputRef      = useRef<HTMLInputElement>(null)
  const resultsRef    = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const runQuery = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setLoading(true)
    setError(null)
    setClients(null)
    setExplanation(null)
    setRawFilters(null)

    try {
      const res = await fetch('/api/ai-filter-clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }

      setExplanation(data.explanation)
      setClients(data.clients)
      setRawFilters(data.filters)

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) runQuery(query)
    if (e.key === 'Escape') onClose()
  }

  const handleSuggestion = (s: string) => {
    setQuery(s)
    runQuery(s)
  }

  const reset = () => {
    setQuery('')
    setClients(null)
    setExplanation(null)
    setError(null)
    setRawFilters(null)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r from-indigo-50/60 to-violet-50/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-sm">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI Client Search</h2>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Ask in plain English — AI extracts safe filters</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Search input ────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Find married clients with children above age 40"'
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              disabled={loading}
            />
          </div>
          <button
            onClick={() => runQuery(query)}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
            {loading ? 'Searching…' : 'Search'}
          </button>
          {(clients !== null || error) && (
            <button
              onClick={reset}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              title="Clear results"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Suggestion chips */}
        {clients === null && !loading && !error && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable results area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading skeleton */}
        {loading && (
          <div className="px-6 py-8 space-y-3">
            <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing query and filtering clients…
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mx-6 mt-5 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3.5">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Search failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
              {error.includes('ANTHROPIC_API_KEY') && (
                <p className="text-xs text-red-500 mt-1.5">
                  Add <code className="font-mono bg-red-100 px-1 rounded">ANTHROPIC_API_KEY</code> to your <code className="font-mono bg-red-100 px-1 rounded">.env.local</code> file to enable AI search.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {clients !== null && !loading && (
          <div ref={resultsRef} className="px-6 py-5 space-y-4">

            {/* Explanation banner */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{explanation}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {clients.length === 0
                      ? 'No clients matched this filter'
                      : `${clients.length} client${clients.length !== 1 ? 's' : ''} matched`}
                  </p>
                </div>
              </div>

              {/* Applied filters toggle */}
              {rawFilters && (
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  Applied filters
                  {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>

            {/* Raw filters (collapsible) */}
            {showFilters && rawFilters && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Extracted filters</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(rawFilters)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => (
                      <span key={k} className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <span className="text-slate-400">{k.replace(/_/g, ' ')}:</span>{' '}
                        {Array.isArray(v) ? v.join(', ') : String(v)}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Results table */}
            {clients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No clients matched</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your query or broadening the criteria</p>
                <button
                  onClick={reset}
                  className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Try another query →
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Name</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Age</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Occupation</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</th>
                        <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. FYC</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last Contacted</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Next Action</th>
                        <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c, i) => (
                        <tr
                          key={c.id}
                          className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors group"
                        >
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={c.full_name} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                                  {c.preferred_name ?? c.full_name}
                                </p>
                                {c.preferred_name && c.preferred_name !== c.full_name && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{c.full_name}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Age */}
                          <td className="px-3 py-3 text-xs text-slate-600 tabular-nums">
                            {c.age ?? '—'}
                          </td>

                          {/* Occupation */}
                          <td className="px-3 py-3">
                            <span className="text-xs text-slate-600 truncate block max-w-[140px]" title={c.occupation ?? ''}>
                              {c.occupation ?? <span className="text-slate-300">—</span>}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <StatusBadge status={c.status} />
                          </td>

                          {/* FYC */}
                          <td className="px-3 py-3 text-right tabular-nums">
                            {c.estimated_fyc > 0
                              ? <span className="text-xs font-semibold text-indigo-600">{formatCurrency(c.estimated_fyc)}</span>
                              : <span className="text-xs text-slate-300">—</span>
                            }
                          </td>

                          {/* Last contacted */}
                          <td className="px-3 py-3">
                            <span className={`text-xs ${c.last_contacted ? 'text-slate-600' : 'text-slate-300'}`}>
                              {relativeDate(c.last_contacted)}
                            </span>
                          </td>

                          {/* Next action */}
                          <td className="px-3 py-3">
                            {c.next_action ? (
                              <div className="min-w-0">
                                <p className="text-xs text-slate-700 truncate max-w-[140px]" title={c.next_action}>
                                  {c.next_action}
                                </p>
                                {c.next_action_date && (
                                  <p className={`text-[10px] mt-0.5 ${
                                    new Date(c.next_action_date) < new Date()
                                      ? 'text-red-500 font-medium'
                                      : 'text-slate-400'
                                  }`}>
                                    {futureDate(c.next_action_date)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          {/* View link */}
                          <td className="px-3 py-3">
                            <Link
                              href={`/clients/${c.id}`}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400">
                    {clients.length} result{clients.length !== 1 ? 's' : ''} · Filters applied by AI, queries run safely server-side
                  </p>
                  <button
                    onClick={reset}
                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    New search
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
