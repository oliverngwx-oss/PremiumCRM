import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/pipeline/PipelineBoard'
import type { Opportunity, Client, Tag } from '@/types/database'

export const metadata: Metadata = { title: 'Pipeline' }

export type OppWithClient = Opportunity & {
  clients: Pick<Client, 'id' | 'full_name' | 'preferred_name' | 'profile_photo_url'> | null
}

export default async function PipelinePage() {
  const SUPABASE_CONFIGURED =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_CONFIGURED) {
    return (
      <PipelineBoard
        initialOpps={[]}
        allTags={[]}
        userId=""
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [oppsRes, tagsRes] = await Promise.all([
    db
      .from('opportunities')
      .select('*, clients(id, full_name, preferred_name, profile_photo_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    db
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name'),
  ])

  return (
    <PipelineBoard
      initialOpps={(oppsRes.data ?? []) as OppWithClient[]}
      allTags={(tagsRes.data ?? []) as Tag[]}
      userId={user.id}
    />
  )
}
