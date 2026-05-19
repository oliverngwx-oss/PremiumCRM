import { TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import SignupForm from './SignupForm'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignupPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Premium CRM</span>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold text-white leading-snug">
            Your clients.<br />Your pipeline.<br />Your goals.
          </h2>
          <ul className="space-y-3">
            {[
              'Full client relationship management',
              'Pipeline & opportunity tracking',
              'FYC & ANP goal monitoring',
              'AI-powered client search',
              'Coverage & retirement checklists',
            ].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <p className="text-xs text-slate-600">Your data is fully isolated — no other advisor can see your clients.</p>
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
            <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
            <p className="mt-1.5 text-sm text-slate-500">Get started — your data stays yours</p>
          </div>

          <SignupForm />

          <p className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
