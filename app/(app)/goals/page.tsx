import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import GoalsPage from '@/components/goals/GoalsPage'
import type { Goal, Opportunity } from '@/types/database'

export const metadata: Metadata = { title: 'Goals' }

const OPEN_STAGES = [
  'new_lead', 'contacted', 'appointment_set', 'fact_find', 'proposal', 'closing',
]

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function GoalsRoute() {
  if (!SUPABASE_CONFIGURED) {
    return <GoalsPage goals={[]} wonOpps={[]} openOpps={[]} userId="" />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = supabase as any
  const currentYear = new Date().getFullYear()

  const [goalsRes, wonOppsRes, openOppsRes] = await Promise.all([
    db
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_year', currentYear),
    db
      .from('opportunities')
      .select('id, estimated_fyc, estimated_anp, probability, expected_close_date, stage, title')
      .eq('user_id', user.id)
      .eq('stage', 'won'),
    db
      .from('opportunities')
      .select('id, estimated_fyc, estimated_anp, probability, expected_close_date, stage, title')
      .eq('user_id', user.id)
      .in('stage', OPEN_STAGES),
  ])

  return (
    <GoalsPage
      goals={(goalsRes.data ?? []) as Goal[]}
      wonOpps={(wonOppsRes.data ?? []) as Opportunity[]}
      openOpps={(openOppsRes.data ?? []) as Opportunity[]}
      userId={user.id}
    />
  )
}
