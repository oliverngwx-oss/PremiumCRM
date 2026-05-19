import { createClient } from '@/lib/supabase/server'
import ClientsPageClient from '@/components/clients/ClientsPageClient'
import type { Client, Tag } from '@/types/database'

export default async function ClientsPage() {
  const SUPABASE_CONFIGURED =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_CONFIGURED) {
    return (
      <ClientsPageClient
        initialClients={[]}
        allTags={[]}
        userId=""
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <ClientsPageClient
        initialClients={[]}
        allTags={[]}
        userId=""
      />
    )
  }

  const [clientsRes, tagsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*, client_tags(tags(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name'),
  ])

  const clients = (clientsRes.data ?? []) as (Client & {
    client_tags?: Array<{ tags: Tag | null }>
  })[]
  const allTags = (tagsRes.data ?? []) as Tag[]

  return (
    <ClientsPageClient
      initialClients={clients}
      allTags={allTags}
      userId={user.id}
    />
  )
}
