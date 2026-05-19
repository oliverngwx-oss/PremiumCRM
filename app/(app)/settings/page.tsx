import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import SettingsPage from '@/components/settings/SettingsPage'
import type { Profile } from '@/types/database'

export const metadata: Metadata = { title: 'Settings' }

export default async function Settings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <SettingsPage
      profile={(profile ?? null) as Profile | null}
      userEmail={user.email ?? ''}
      userId={user.id}
    />
  )
}
