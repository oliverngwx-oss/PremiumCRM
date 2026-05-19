import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// ─── Filter schema (what Claude extracts) ─────────────────────────────────────

interface AIFilters {
  age_min?:               number | null
  age_max?:               number | null
  statuses?:              string[] | null
  client_types?:          string[] | null
  marital_statuses?:      string[] | null
  has_children?:          boolean | null
  min_children?:          number | null
  occupation_keywords?:   string[] | null
  min_fyc?:               number | null
  max_fyc?:               number | null
  no_activity_since_days?: number | null
  no_contact_since_days?: number | null
  sources?:               string[] | null
}

interface AIResponse {
  filters:     AIFilters
  explanation: string
}

// ─── Result shape returned to the client ─────────────────────────────────────

export interface ClientFilterResult {
  id:               string
  full_name:        string
  preferred_name:   string | null
  age:              number | null
  occupation:       string | null
  status:           string
  estimated_fyc:    number
  last_contacted:   string | null
  next_action:      string | null
  next_action_date: string | null
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a filter extractor for a financial advisor CRM. Convert natural language queries into structured JSON filters for a client database.

Available filter fields (all optional, set to null if not applicable):
- age_min: number (clients aged this or older)
- age_max: number (clients aged this or younger)
- statuses: string[] — "prospect" | "active" | "vip" | "inactive" | "lost"
- client_types: string[] — "prospect" | "active" | "vip" | "inactive" | "referral" | "former"
- marital_statuses: string[] — "single" | "married" | "divorced" | "widowed" | "separated" | "other"
- has_children: boolean (true = at least 1 child)
- min_children: number (minimum number of children)
- occupation_keywords: string[] (substrings to match in occupation, case-insensitive; use short root words)
- min_fyc: number (minimum total estimated FYC across open/active opportunities)
- max_fyc: number
- no_activity_since_days: number (no activity of any kind logged in the past N days)
- no_contact_since_days: number (no call, email, or meeting logged in the past N days; use for "not contacted", "no follow-up", "not reached")
- sources: string[] — "referral" | "cold_call" | "social_media" | "event" | "website" | "existing_client" | "walk_in" | "other"

Rules:
- "warm prospects" means statuses: ["prospect"] with no_contact_since_days between 14-60 depending on context
- "recent follow-up" or "follow-up" typically maps to no_contact_since_days
- "above age X" means age_min: X+1; "at least age X" means age_min: X
- For occupation queries like "nurses or teachers", use occupation_keywords: ["nurs", "teach"] (root forms)
- "married with children" means marital_statuses: ["married"], has_children: true
- "prospects" alone maps to statuses: ["prospect"]
- Only use fields that the query clearly implies. Leave all others null.

Output ONLY valid JSON with exactly two keys: "filters" (object) and "explanation" (string). No other text, no markdown, no code fences.

Examples:
Query: "Show me clients above age 50"
{"filters":{"age_min":51},"explanation":"Clients aged 51 and above"}

Query: "Find warm prospects who have not been contacted in 30 days"
{"filters":{"statuses":["prospect"],"no_contact_since_days":30},"explanation":"Prospects with no calls, emails, or meetings in the past 30 days"}

Query: "Show me all nurses or teachers"
{"filters":{"occupation_keywords":["nurs","teach"]},"explanation":"Clients whose occupation includes 'nurse' or 'teacher'"}

Query: "Find clients who are married with children"
{"filters":{"marital_statuses":["married"],"has_children":true},"explanation":"Married clients with at least one child"}

Query: "Show me prospects with estimated FYC above 3000"
{"filters":{"statuses":["prospect"],"min_fyc":3000},"explanation":"Prospects with total estimated FYC above $3,000"}

Query: "Find clients with no recent follow-up"
{"filters":{"no_contact_since_days":30},"explanation":"Clients with no calls, emails, or meetings in the past 30 days"}`

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
    }

    // ── Call Claude to extract filters ──────────────────────────────────────
    const anthropic = new Anthropic({ apiKey })
    const aiMsg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: query.trim() }],
    })

    const rawText = aiMsg.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')
      .trim()

    let aiResponse: AIResponse
    try {
      aiResponse = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: rawText }, { status: 500 })
    }

    const { filters, explanation } = aiResponse
    const db = supabase as any

    // ── Build base client query with simple DB-side filters ─────────────────
    let clientQuery = db
      .from('clients')
      .select('id, full_name, preferred_name, age, occupation, status, marital_status, number_of_children, source, client_type')
      .eq('user_id', user.id)

    if (filters.age_min)             clientQuery = clientQuery.gte('age', filters.age_min)
    if (filters.age_max)             clientQuery = clientQuery.lte('age', filters.age_max)
    if (filters.statuses?.length)    clientQuery = clientQuery.in('status', filters.statuses)
    if (filters.client_types?.length) clientQuery = clientQuery.in('client_type', filters.client_types)
    if (filters.marital_statuses?.length) clientQuery = clientQuery.in('marital_status', filters.marital_statuses)
    if (filters.has_children === true) clientQuery = clientQuery.gt('number_of_children', 0)
    if (filters.min_children)        clientQuery = clientQuery.gte('number_of_children', filters.min_children)
    if (filters.sources?.length)     clientQuery = clientQuery.in('source', filters.sources)

    if (filters.occupation_keywords?.length) {
      const orClause = filters.occupation_keywords
        .map((k: string) => `occupation.ilike.%${k}%`)
        .join(',')
      clientQuery = clientQuery.or(orClause)
    }

    const { data: clientRows, error: clientErr } = await clientQuery.order('full_name')
    if (clientErr) throw clientErr

    if (!clientRows || clientRows.length === 0) {
      return NextResponse.json({ explanation, filters, clients: [] })
    }

    const clientIds: string[] = clientRows.map((c: any) => c.id)

    // ── Fetch activities + opportunities in parallel ─────────────────────────
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2) // limit activity lookback

    const [activitiesRes, oppsRes] = await Promise.all([
      db
        .from('activities')
        .select('client_id, type, status, scheduled_at, completed_at, subject, created_at')
        .in('client_id', clientIds)
        .gte('created_at', cutoffDate.toISOString())
        .order('scheduled_at', { ascending: true }),
      db
        .from('opportunities')
        .select('client_id, estimated_fyc, stage')
        .in('client_id', clientIds)
        .in('stage', ['new_lead', 'contacted', 'appointment_set', 'fact_find', 'proposal', 'closing', 'won']),
    ])

    type ActivityRow = {
      client_id: string; type: string; status: string;
      scheduled_at: string | null; completed_at: string | null; subject: string; created_at: string
    }
    type OppRow = { client_id: string; estimated_fyc: number | null; stage: string }

    const activities: ActivityRow[] = activitiesRes.data ?? []
    const opps: OppRow[]            = oppsRes.data ?? []

    // Index by client_id
    const actByClient = new Map<string, ActivityRow[]>()
    for (const a of activities) {
      if (!actByClient.has(a.client_id)) actByClient.set(a.client_id, [])
      actByClient.get(a.client_id)!.push(a)
    }

    const fycByClient = new Map<string, number>()
    for (const o of opps) {
      fycByClient.set(o.client_id, (fycByClient.get(o.client_id) ?? 0) + (o.estimated_fyc ?? 0))
    }

    const CONTACT_TYPES = new Set(['call', 'email', 'meeting', 'presentation'])
    const now = Date.now()

    // ── In-memory post-filters + build result rows ──────────────────────────
    const results: ClientFilterResult[] = []

    for (const c of clientRows as any[]) {
      const clientActs = actByClient.get(c.id) ?? []
      const fycTotal   = fycByClient.get(c.id) ?? 0

      // FYC filter
      if (filters.min_fyc && fycTotal < filters.min_fyc) continue
      if (filters.max_fyc && fycTotal > filters.max_fyc) continue

      // Activity recency filters
      if (filters.no_activity_since_days) {
        const cutoff = now - filters.no_activity_since_days * 86400000
        const lastAct = clientActs
          .map(a => new Date(a.completed_at ?? a.scheduled_at ?? a.created_at).getTime())
          .filter(t => !isNaN(t))
          .reduce((m, t) => Math.max(m, t), 0)
        if (lastAct > cutoff) continue // has recent activity — exclude
      }

      if (filters.no_contact_since_days) {
        const cutoff = now - filters.no_contact_since_days * 86400000
        const lastContact = clientActs
          .filter(a => CONTACT_TYPES.has(a.type))
          .map(a => new Date(a.completed_at ?? a.scheduled_at ?? a.created_at).getTime())
          .filter(t => !isNaN(t))
          .reduce((m, t) => Math.max(m, t), 0)
        if (lastContact > cutoff) continue // contacted recently — exclude
      }

      // Last contacted (most recent call/email/meeting)
      const contactDates = clientActs
        .filter(a => CONTACT_TYPES.has(a.type))
        .map(a => a.completed_at ?? a.scheduled_at ?? a.created_at)
        .filter(Boolean) as string[]
      contactDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      const last_contacted = contactDates[0] ?? null

      // Next action (next planned activity)
      const upcoming = clientActs
        .filter(a => a.status === 'planned' && a.scheduled_at && new Date(a.scheduled_at) >= new Date())
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      const next_action      = upcoming[0]?.subject ?? null
      const next_action_date = upcoming[0]?.scheduled_at ?? null

      results.push({
        id:               c.id,
        full_name:        c.full_name,
        preferred_name:   c.preferred_name,
        age:              c.age,
        occupation:       c.occupation,
        status:           c.status,
        estimated_fyc:    fycTotal,
        last_contacted,
        next_action,
        next_action_date,
      })
    }

    return NextResponse.json({ explanation, filters, clients: results })

  } catch (err: any) {
    console.error('[ai-filter-clients]', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
