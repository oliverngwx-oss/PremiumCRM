import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import type { Profile } from '@/types/database'

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let profile: Pick<Profile, 'full_name' | 'role'> | null = null
  let userEmail: string | undefined
  let userId: string | undefined

  if (SUPABASE_CONFIGURED) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    userEmail = user.email
    userId = user.id

    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    profile = data as Pick<Profile, 'full_name' | 'role'> | null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        userName={profile?.full_name}
        userEmail={userEmail}
        userRole={profile?.role}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={profile?.full_name} userId={userId} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
