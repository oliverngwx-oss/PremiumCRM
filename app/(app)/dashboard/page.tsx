import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Users, Target, Briefcase, TrendingUp, DollarSign,
} from 'lucide-react'
import MetricCard from '@/components/dashboard/MetricCard'
import GoalProgressCard from '@/components/dashboard/GoalProgressCard'
import PipelineChart from '@/components/dashboard/PipelineChart'
import UpcomingFollowups from '@/components/dashboard/UpcomingFollowups'
import RecentActivities from '@/components/dashboard/RecentActivities'
import { formatCurrency } from '@/lib/utils'
import type { Goal } from '@/types/database'

export const metadata: Metadata = { title: 'Dashboard' }

const OPEN_STAGES = ['new_lead', 'contacted', 'appointment_set', 'fact_find', 'proposal', 'closing'] as const

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function DashboardPage() {
  if (!SUPABASE_CONFIGURED) return <DashboardShell empty />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const currentYear    = now.getFullYear()
  const currentMonth   = now.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  // Period boundaries for won-opp achievement computation
  const monthStart   = new Date(currentYear, currentMonth - 1, 1).toISOString()
  const monthEnd     = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString()
  const quarterStart = new Date(currentYear, (currentQuarter - 1) * 3, 1).toISOString()
  const quarterEnd   = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59).toISOString()
  const yearStart    = new Date(currentYear, 0, 1).toISOString()
  const yearEnd      = new Date(currentYear, 11, 31, 23, 59, 59).toISOString()

  const db = supabase as any

  const [
    totalClientsRes,
    prospectsRes,
    openOppCountRes,
    openOppValuesRes,
    monthlyGoalRes,
    quarterlyGoalRes,
    annualGoalRes,
    recentActivitiesRes,
    upcomingFollowupsRes,
    pipelineStagesRes,
    wonMonthRes,
    wonQuarterRes,
    wonAnnualRes,
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'prospect'),
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).in('stage', OPEN_STAGES),
    supabase.from('opportunities').select('estimated_anp, estimated_fyc').in('stage', OPEN_STAGES),
    db.from('goals').select('*')
      .eq('period_type', 'monthly')
      .eq('period_year', currentYear)
      .eq('period_month', currentMonth)
      .maybeSingle(),
    db.from('goals').select('*')
      .eq('period_type', 'quarterly')
      .eq('period_year', currentYear)
      .eq('period_quarter', currentQuarter)
      .maybeSingle(),
    db.from('goals').select('*')
      .eq('period_type', 'annual')
      .eq('period_year', currentYear)
      .maybeSingle(),
    supabase.from('activities')
      .select('*, clients(full_name, preferred_name)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('activities')
      .select('*, clients(full_name, preferred_name)')
      .eq('status', 'planned')
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabase.from('opportunities')
      .select('stage, estimated_anp, estimated_fyc')
      .in('stage', OPEN_STAGES),
    db.from('opportunities')
      .select('estimated_fyc, estimated_anp')
      .eq('stage', 'won')
      .gte('expected_close_date', monthStart)
      .lte('expected_close_date', monthEnd),
    db.from('opportunities')
      .select('estimated_fyc, estimated_anp')
      .eq('stage', 'won')
      .gte('expected_close_date', quarterStart)
      .lte('expected_close_date', quarterEnd),
    db.from('opportunities')
      .select('estimated_fyc, estimated_anp')
      .eq('stage', 'won')
      .gte('expected_close_date', yearStart)
      .lte('expected_close_date', yearEnd),
  ])

  type OppValue   = { estimated_anp: number | null; estimated_fyc: number | null }
  type OppStage   = { stage: string; estimated_anp: number | null; estimated_fyc: number | null }

  // ── Won-opp achievements (computed from pipeline, not stored field) ───────
  const sum = (rows: OppValue[], field: keyof OppValue) =>
    ((rows ?? []) as OppValue[]).reduce((s, o) => s + ((o[field] as number | null) ?? 0), 0)

  const monthFycAchieved   = sum(wonMonthRes.data   ?? [], 'estimated_fyc')
  const monthAnpAchieved   = sum(wonMonthRes.data   ?? [], 'estimated_anp')
  const quarterFycAchieved = sum(wonQuarterRes.data ?? [], 'estimated_fyc')
  const quarterAnpAchieved = sum(wonQuarterRes.data ?? [], 'estimated_anp')
  const annualFycAchieved  = sum(wonAnnualRes.data  ?? [], 'estimated_fyc')
  const annualAnpAchieved  = sum(wonAnnualRes.data  ?? [], 'estimated_anp')

  // ── Aggregates ────────────────────────────────────────────
  const totalClients = totalClientsRes.count ?? 0
  const activeProspects = prospectsRes.count ?? 0
  const openOpportunities = openOppCountRes.count ?? 0

  const openOppValues = (openOppValuesRes.data ?? []) as OppValue[]
  const totalANP = openOppValues.reduce((s, o) => s + (o.estimated_anp ?? 0), 0)
  const totalFYC = openOppValues.reduce((s, o) => s + (o.estimated_fyc ?? 0), 0)

  // ── Pipeline by stage ─────────────────────────────────────
  const stageAccum: Record<string, { count: number; anp: number; fyc: number }> = {}
  OPEN_STAGES.forEach(s => { stageAccum[s] = { count: 0, anp: 0, fyc: 0 } })
  for (const o of (pipelineStagesRes.data ?? []) as OppStage[]) {
    if (stageAccum[o.stage]) {
      stageAccum[o.stage].count++
      stageAccum[o.stage].anp += o.estimated_anp ?? 0
      stageAccum[o.stage].fyc += o.estimated_fyc ?? 0
    }
  }
  const STAGE_LABELS: Record<string, string> = {
    new_lead: 'New Lead', contacted: 'Contacted', appointment_set: 'Appt. Set',
    fact_find: 'Fact Find', proposal: 'Proposal', closing: 'Closing',
  }
  const pipelineData = OPEN_STAGES.map(key => ({
    stage: STAGE_LABELS[key] ?? key,
    stageKey: key,
    count: stageAccum[key].count,
    fyc: stageAccum[key].fyc,
    anp: stageAccum[key].anp,
  }))

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Metric Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Total Clients"
          value={totalClients.toLocaleString()}
          icon={Users}
          color="blue"
          subtitle="In your database"
        />
        <MetricCard
          title="Active Prospects"
          value={activeProspects.toLocaleString()}
          icon={Target}
          color="violet"
          subtitle="Status: prospect"
        />
        <MetricCard
          title="Open Opportunities"
          value={openOpportunities.toLocaleString()}
          icon={Briefcase}
          color="indigo"
          subtitle="Across all stages"
        />
        <MetricCard
          title="Total Est. ANP"
          value={formatCurrency(totalANP, true)}
          icon={TrendingUp}
          color="emerald"
          subtitle="Annual new premium"
        />
        <MetricCard
          title="Total Est. FYC"
          value={formatCurrency(totalFYC, true)}
          icon={DollarSign}
          color="amber"
          subtitle="First year commission"
        />
      </div>

      {/* ── Goal Progress ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Goal Progress</h2>
          <a href="/goals" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Manage goals →
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GoalProgressCard
            title="Monthly FYC"
            period="monthly"
            goal={monthlyGoalRes.data as Goal | null}
            fycAchieved={monthFycAchieved}
            anpAchieved={monthAnpAchieved}
          />
          <GoalProgressCard
            title="Quarterly FYC"
            period="quarterly"
            goal={quarterlyGoalRes.data as Goal | null}
            fycAchieved={quarterFycAchieved}
            anpAchieved={quarterAnpAchieved}
          />
          <GoalProgressCard
            title="Annual FYC"
            period="annual"
            goal={annualGoalRes.data as Goal | null}
            fycAchieved={annualFycAchieved}
            anpAchieved={annualAnpAchieved}
          />
        </div>
      </div>

      {/* ── Pipeline + Follow-ups ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PipelineChart data={pipelineData} />
        </div>
        <div>
          <UpcomingFollowups
            activities={(upcomingFollowupsRes.data ?? []) as any}
          />
        </div>
      </div>

      {/* ── Recent Activities ─────────────────────────────── */}
      <RecentActivities activities={(recentActivitiesRes.data ?? []) as any} />

    </div>
  )
}

function DashboardShell({ empty }: { empty?: boolean }) {
  const emptyPipeline = OPEN_STAGES.map(key => ({
    stage: key.charAt(0).toUpperCase() + key.slice(1),
    stageKey: key, count: 0, fyc: 0, anp: 0,
  }))
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {empty && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-800">
          <strong>Supabase not configured.</strong> Copy <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env.local.example</code> to <code className="font-mono text-xs bg-amber-100 px-1 rounded">.env.local</code> and add your project keys to see live data.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { title: 'Total Clients',       value: '—', icon: Users,      color: 'blue'    as const },
          { title: 'Active Prospects',    value: '—', icon: Target,     color: 'violet'  as const },
          { title: 'Open Opportunities',  value: '—', icon: Briefcase,  color: 'indigo'  as const },
          { title: 'Total Est. ANP',      value: '—', icon: TrendingUp, color: 'emerald' as const },
          { title: 'Total Est. FYC',      value: '—', icon: DollarSign, color: 'amber'   as const },
        ].map(c => <MetricCard key={c.title} {...c} subtitle="Connect Supabase to load" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['monthly', 'quarterly', 'annual'] as const).map(p => (
          <GoalProgressCard key={p} title={`${p.charAt(0).toUpperCase() + p.slice(1)} FYC`} period={p} goal={null} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><PipelineChart data={emptyPipeline} /></div>
        <UpcomingFollowups activities={[]} />
      </div>
      <RecentActivities activities={[]} />
    </div>
  )
}
