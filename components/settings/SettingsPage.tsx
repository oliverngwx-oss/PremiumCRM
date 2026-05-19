'use client'

import { useState } from 'react'
import { User, Mail, Phone, Briefcase, FileText, Save, Loader2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface SettingsPageProps {
  profile: Profile | null
  userEmail: string
  userId: string
}

type Section = 'profile' | 'account'

export default function SettingsPage({ profile: initial, userEmail, userId }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<Section>('profile')

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200/80 px-6 py-5">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex flex-col md:flex-row gap-6">

          {/* Sidebar nav */}
          <nav className="md:w-48 shrink-0">
            <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
              {([
                { id: 'profile', label: 'Profile',  icon: User },
                { id: 'account', label: 'Account',  icon: KeyRound },
              ] as { id: Section; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-slate-50 last:border-0',
                    activeSection === id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeSection === 'profile' && (
              <ProfileSection profile={initial} userId={userId} userEmail={userEmail} />
            )}
            {activeSection === 'account' && (
              <AccountSection userEmail={userEmail} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ profile: initial, userId, userEmail }: {
  profile: Profile | null
  userId: string
  userEmail: string
}) {
  const [fullName,      setFullName]      = useState(initial?.full_name ?? '')
  const [preferredName, setPreferredName] = useState(initial?.preferred_name ?? '')
  const [phone,         setPhone]         = useState(initial?.phone ?? '')
  const [company,       setCompany]       = useState(initial?.company ?? '')
  const [bio,           setBio]           = useState(initial?.bio ?? '')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    const supabase = createClient() as any
    const { error: err } = await supabase
      .from('profiles')
      .upsert({
        id:             userId,
        full_name:      fullName.trim() || null,
        preferred_name: preferredName.trim() || null,
        phone:          phone.trim() || null,
        company:        company.trim() || null,
        bio:            bio.trim() || null,
      })
      .eq('id', userId)

    if (err) {
      setError(err.message ?? 'Failed to save profile')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Profile Information</h2>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Your name and contact details visible across the app</p>
      </div>

      <form onSubmit={handleSave} className="px-6 py-5 space-y-4">

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" icon={User}>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className={inputCls}
            />
          </Field>
          <Field label="Preferred Name" icon={User}>
            <input
              type="text"
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              placeholder="What you go by"
              className={inputCls}
            />
          </Field>
          <Field label="Email" icon={Mail}>
            <input
              type="email"
              value={userEmail}
              disabled
              className={cn(inputCls, 'opacity-50 cursor-not-allowed')}
            />
          </Field>
          <Field label="Phone" icon={Phone}>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+65 9123 4567"
              className={inputCls}
            />
          </Field>
          <Field label="Company / Agency" icon={Briefcase} className="sm:col-span-2">
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Your firm or agency"
              className={inputCls}
            />
          </Field>
          <Field label="Bio" icon={FileText} className="sm:col-span-2">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="A short description about yourself…"
              className={cn(inputCls, 'resize-none')}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Account Section ──────────────────────────────────────────────────────────

function AccountSection({ userEmail }: { userEmail: string }) {
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function sendPasswordReset() {
    setSending(true)
    setSent(false)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (err) {
      setError(err.message ?? 'Failed to send reset email')
    } else {
      setSent(true)
    }
    setSending(false)
  }

  return (
    <div className="space-y-4">
      {/* Email display */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Account Email</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Your sign-in email address</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-slate-800">{userEmail}</p>
          <p className="text-xs text-slate-400 mt-0.5">Email changes must be done through Supabase Auth.</p>
        </div>
      </div>

      {/* Password reset */}
      <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Password</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Reset your password via email</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          {sent ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Password reset email sent to <span className="font-semibold">{userEmail}</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                We'll send a password reset link to <span className="font-medium">{userEmail}</span>.
              </p>
              <button
                onClick={sendPasswordReset}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                {sending ? 'Sending…' : 'Send Reset Email'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition'

function Field({ label, icon: Icon, children, className }: {
  label: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  )
}
