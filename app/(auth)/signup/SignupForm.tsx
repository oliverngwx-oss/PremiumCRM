'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, Loader2, User, CheckCircle2 } from 'lucide-react'

export default function SignupForm() {
  const router = useRouter()
  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showCon,   setShowCon]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If email confirmation is disabled in Supabase, session is returned immediately
    if (data.session) {
      // Upsert profile row with full name
      const db = supabase as any
      await db.from('profiles').upsert({
        id:        data.user!.id,
        full_name: fullName.trim() || null,
        role:      'advisor',
      })
      router.push('/dashboard')
      router.refresh()
    } else {
      // Email confirmation required — show confirmation message
      setConfirmed(true)
    }

    setLoading(false)
  }

  if (confirmed) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-900">Check your email</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          We sent a confirmation link to <span className="font-medium text-slate-700">{email}</span>.
          Click it to activate your account, then come back to sign in.
        </p>
        <a
          href="/login"
          className="inline-block mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to sign in →
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Full name */}
      <div className="space-y-1.5">
        <label htmlFor="fullName" className="text-xs font-medium text-slate-700">Full name</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-slate-700">Email address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium text-slate-700">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowPw(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-xs font-medium text-slate-700">Confirm password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="confirm"
            type={showCon ? 'text' : 'password'}
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowCon(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showCon ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-[11px] text-slate-400 leading-relaxed">
        By signing up you agree that your data is stored securely and privately.
      </p>
    </form>
  )
}
