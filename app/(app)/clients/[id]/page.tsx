import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientProfilePage from '@/components/clients/profile/ClientProfilePage'
import type { Client, Tag, Opportunity, Note, Activity, UploadedFile, PlanningChecklist, RetirementProfile, RetirementActionItem } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params

  const SUPABASE_CONFIGURED =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_CONFIGURED) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch all data in parallel
  const [clientRes, allTagsRes, oppsRes, notesRes, activitiesRes, filesRes, checklistRes, retirementProfileRes, retirementActionsRes] = await Promise.all([
    db.from('clients').select('*, client_tags(tags(*))').eq('id', id).eq('user_id', user.id).single(),
    db.from('tags').select('*').eq('user_id', user.id).order('name'),
    db.from('opportunities').select('*').eq('client_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
    db.from('notes').select('*').eq('client_id', id).eq('user_id', user.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    db.from('activities').select('*').eq('client_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
    db.from('uploaded_files').select('*').eq('client_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
    db.from('client_planning_checklist').select('*').eq('client_id', id).eq('user_id', user.id),
    db.from('client_retirement_profile').select('*').eq('client_id', id).eq('user_id', user.id).maybeSingle(),
    db.from('client_retirement_action_items').select('*').eq('client_id', id).eq('user_id', user.id).order('sort_order'),
  ])

  if (!clientRes.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = clientRes.data as any
  const clientTags: Tag[] = (rawClient.client_tags ?? [])
    .map((ct: { tags: Tag | null }) => ct.tags)
    .filter((t: Tag | null): t is Tag => t !== null)

  const client = rawClient as unknown as Client

  return (
    <ClientProfilePage
      client={client}
      tags={clientTags}
      allTags={(allTagsRes.data ?? []) as Tag[]}
      opportunities={(oppsRes.data ?? []) as Opportunity[]}
      notes={(notesRes.data ?? []) as Note[]}
      activities={(activitiesRes.data ?? []) as Activity[]}
      files={(filesRes.data ?? []) as UploadedFile[]}
      checklist={(checklistRes.data ?? []) as PlanningChecklist[]}
      retirementProfile={(retirementProfileRes.data ?? null) as RetirementProfile | null}
      retirementActions={(retirementActionsRes.data ?? []) as RetirementActionItem[]}
      userId={user.id}
    />
  )
}
