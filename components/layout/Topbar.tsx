'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, Search, Plus, Loader2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ClientFormDrawer from '@/components/clients/ClientFormDrawer'
import type { Tag } from '@/types/database'

const pageTitles: Record<string, { title: string; description: string }> = {
  '/dashboard':  { title: 'Dashboard',   description: 'Your business at a glance' },
  '/clients':    { title: 'Clients',     description: 'Manage your client relationships' },
  '/pipeline':   { title: 'Pipeline',    description: 'Track your sales opportunities' },
  '/goals':      { title: 'Goals',       description: 'Monitor your FYC and ANP targets' },
  '/activities': { title: 'Activities',  description: 'Log calls, meetings, and tasks' },
  '/notes':      { title: 'Notes',       description: 'Meeting notes and client history' },
  '/files':      { title: 'Files',       description: 'Client documents and uploads' },
  '/settings':   { title: 'Settings',    description: 'Account and preferences' },
}

interface TopbarProps {
  userName?: string | null
  userId?: string
}

export default function Topbar({ userName, userId }: TopbarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const base = '/' + pathname.split('/')[1]
  const page = pageTitles[base] ?? { title: 'Premium CRM', description: '' }
  const greeting = getGreeting()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [allTags,    setAllTags]    = useState<Tag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  const openDrawer = useCallback(async () => {
    if (!userId) return
    if (allTags.length === 0 && !loadingTags) {
      setLoadingTags(true)
      const supabase = createClient() as any
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('name')
      setAllTags((data ?? []) as Tag[])
      setLoadingTags(false)
    }
    setDrawerOpen(true)
  }, [userId, allTags.length, loadingTags])

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-sm px-6">
        {/* Left: greeting / page context */}
        <div>
          {base === '/dashboard' ? (
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-none">
                {greeting}, {firstName(userName)}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-none">{todayLabel()}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-none">{page.title}</h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-none">{page.description}</p>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Search…</span>
            <kbd className="hidden sm:inline text-[10px] text-slate-300 font-sans">⌘K</kbd>
          </button>

          {/* Notifications */}
          <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
          </button>

          {/* New Client */}
          <button
            onClick={openDrawer}
            disabled={!userId || loadingTags}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {loadingTags
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />
            }
            <span className="hidden sm:inline">New Client</span>
          </button>
        </div>
      </header>

      {userId && (
        <ClientFormDrawer
          open={drawerOpen}
          mode="add"
          allTags={allTags}
          userId={userId}
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => {
            setDrawerOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(name?: string | null) {
  if (!name) return 'there'
  return name.split(' ')[0]
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
