import { TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12 relative overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Premium CRM</span>
        </div>

        {/* Quote */}
        <div className="relative space-y-4">
          <blockquote className="text-2xl font-medium text-white leading-relaxed">
            "The secret of getting ahead is getting started. The secret of getting started is breaking your complex plans into small manageable tasks."
          </blockquote>
          <p className="text-slate-500 text-sm">— Mark Twain</p>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-6">
          {[
            { value: '10k+', label: 'Clients managed' },
            { value: '$2.4M', label: 'FYC tracked' },
            { value: '98%', label: 'Advisor satisfaction' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold text-slate-900">Premium CRM</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to your CRM account</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">
              Create one free
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
