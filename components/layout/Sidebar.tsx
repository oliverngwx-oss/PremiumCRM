'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, GitBranch, Target,
  Activity, FileText, FolderOpen, Settings,
  ChevronLeft, ChevronRight, TrendingUp, LogOut,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/clients',    label: 'Clients',      icon: Users },
  { href: '/pipeline',   label: 'Pipeline',     icon: GitBranch },
  { href: '/goals',      label: 'Goals',        icon: Target },
  { href: '/activities', label: 'Activities',   icon: Activity },
  { href: '/notes',      label: 'Notes',        icon: FileText },
  { href: '/files',      label: 'Files',        icon: FolderOpen },
]

interface SidebarProps {
  userName?: string | null
  userEmail?: string | null
  userRole?: string | null
}

export default function Sidebar({ userName, userEmail, userRole }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-slate-950 transition-all duration-300 ease-in-out select-none',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-slate-300 shadow-md hover:bg-indigo-600 hover:text-white transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 border-b border-slate-800/60',
        'h-16 shrink-0'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white leading-none">Premium CRM</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-none uppercase tracking-widest">
              {userRole ?? 'Advisor'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-4 px-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Menu
          </p>
        )}
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-white' : 'text-slate-500 group-hover:text-slate-200')} />
              {!collapsed && <span className="truncate">{label}</span>}
              {active && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-300" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-slate-800/60 p-3 space-y-1">
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-4.5 w-4.5 shrink-0 text-slate-500" />
          {!collapsed && 'Settings'}
        </Link>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0 text-slate-500" />
          {!collapsed && 'Log out'}
        </button>

        {/* User */}
        <div className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5',
          collapsed && 'justify-center px-2'
        )}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-semibold text-white">
            {userName ? getInitials(userName) : 'U'}
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-xs font-medium text-slate-200 leading-none">
                {userName ?? 'User'}
              </p>
              <p className="truncate text-[10px] text-slate-500 mt-0.5 leading-none">
                {userEmail ?? ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
