// Auto-maintained type definitions matching supabase/migrations/001_create_tables.sql
// Update here whenever the schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ─── Enums ────────────────────────────────────────────────────────────────────

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'other'
export type ClientType    = 'prospect' | 'active' | 'vip' | 'inactive' | 'referral' | 'former'
export type ClientSource  = 'referral' | 'warm' | 'cold_call' | 'social_media' | 'event' | 'website' | 'existing_client' | 'walk_in' | 'other'
export type ClientStatus  = 'prospect' | 'active' | 'inactive' | 'lost' | 'vip'
export type ProductType   = 'life_insurance' | 'health_insurance' | 'investment' | 'retirement' | 'annuity' | 'disability' | 'critical_illness' | 'general_insurance' | 'other'
export type OpportunityStage = 'new_lead' | 'contacted' | 'appointment_set' | 'fact_find' | 'proposal' | 'closing' | 'won' | 'lost' | 'follow_up_later'
export type ActivityType  = 'call' | 'email' | 'meeting' | 'task' | 'follow_up' | 'presentation' | 'review' | 'other'
export type ActivityStatus = 'planned' | 'completed' | 'cancelled' | 'rescheduled'
export type PeriodType    = 'monthly' | 'quarterly' | 'annual'
export type FileCategory  = 'kyc' | 'proposal' | 'policy' | 'id_document' | 'financial_statement' | 'correspondence' | 'other'
export type UserRole      = 'advisor' | 'admin' | 'manager'

// ─── Row types (what the DB returns) ─────────────────────────────────────────

export interface Profile {
  id:             string
  full_name:      string | null
  preferred_name: string | null
  avatar_url:     string | null
  role:           UserRole
  company:        string | null
  phone:          string | null
  bio:            string | null
  created_at:     string
  updated_at:     string
}

export interface Tag {
  id:         string
  user_id:    string
  name:       string
  color:      string
  created_at: string
}

export interface Client {
  id:                 string
  user_id:            string
  full_name:          string
  preferred_name:     string | null
  email:              string | null
  phone:              string | null
  profile_photo_url:  string | null
  age:                number | null
  date_of_birth:      string | null
  occupation:         string | null
  company:            string | null
  address:            string | null
  marital_status:     MaritalStatus | null
  number_of_children: number
  client_type:        ClientType | null
  source:             ClientSource | null
  status:             ClientStatus
  notes:              string | null
  created_at:         string
  updated_at:         string
}

export interface ClientTag {
  id:         string
  user_id:    string
  client_id:  string
  tag_id:     string
  created_at: string
}

export interface Opportunity {
  id:                  string
  user_id:             string
  client_id:           string
  title:               string
  product_type:        ProductType | null
  stage:               OpportunityStage
  estimated_anp:       number | null
  estimated_fyc:       number | null
  probability:         number
  expected_close_date: string | null
  next_action:         string | null
  next_action_date:    string | null
  created_at:          string
  updated_at:          string
}

export interface Activity {
  id:               string
  user_id:          string
  client_id:        string | null
  opportunity_id:   string | null
  type:             ActivityType
  subject:          string
  description:      string | null
  status:           ActivityStatus
  scheduled_at:     string | null
  completed_at:     string | null
  duration_minutes: number | null
  created_at:       string
  updated_at:       string
}

export interface Note {
  id:           string
  user_id:      string
  client_id:    string | null
  activity_id:  string | null
  title:        string | null
  content:      string
  meeting_date: string | null
  is_pinned:    boolean
  created_at:   string
  updated_at:   string
}

export interface Goal {
  id:             string
  user_id:        string
  period_type:    PeriodType
  period_year:    number
  period_month:   number | null
  period_quarter: number | null
  fyc_target:     number
  anp_target:     number
  fyc_achieved:   number
  anp_achieved:   number
  notes:          string | null
  created_at:     string
  updated_at:     string
}

export interface PlanningChecklist {
  id:               string
  user_id:          string
  client_id:        string
  category_name:    string
  is_fulfilled:     boolean
  remarks:          string | null
  last_reviewed_at: string | null
  created_at:       string
  updated_at:       string
}

export interface UploadedFile {
  id:           string
  user_id:      string
  client_id:    string | null
  name:         string
  storage_path: string
  size_bytes:   number | null
  mime_type:    string | null
  description:  string | null
  category:     FileCategory | null
  created_at:   string
  updated_at:   string
}

// ─── Insert types (what you send to the DB) ───────────────────────────────────

export type InsertClient      = Omit<Client, 'id' | 'created_at' | 'updated_at'>
export type InsertOpportunity = Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>
export type InsertActivity    = Omit<Activity, 'id' | 'created_at' | 'updated_at'>
export type InsertNote        = Omit<Note, 'id' | 'created_at' | 'updated_at'>
export type InsertGoal        = Omit<Goal, 'id' | 'created_at' | 'updated_at'>
export type InsertPlanningChecklist = Omit<PlanningChecklist, 'id' | 'created_at' | 'updated_at'>
export type UpdatePlanningChecklist = Partial<InsertPlanningChecklist>
export type InsertUploadedFile = Omit<UploadedFile, 'id' | 'created_at' | 'updated_at'>
export type InsertTag         = Omit<Tag, 'id' | 'created_at'>

export type UpdateClient      = Partial<InsertClient>
export type UpdateOpportunity = Partial<InsertOpportunity>
export type UpdateActivity    = Partial<InsertActivity>
export type UpdateNote        = Partial<InsertNote>
export type UpdateGoal        = Partial<InsertGoal>

// ─── Joined / enriched types used by the UI ───────────────────────────────────

export interface ClientWithTags extends Client {
  tags: Tag[]
}

export interface OpportunityWithClient extends Opportunity {
  client: Pick<Client, 'id' | 'full_name' | 'preferred_name' | 'profile_photo_url'>
}

export interface ActivityWithClient extends Activity {
  client: Pick<Client, 'id' | 'full_name' | 'preferred_name'> | null
}

export interface NoteWithClient extends Note {
  client: Pick<Client, 'id' | 'full_name' | 'preferred_name'> | null
}

// ─── View types ───────────────────────────────────────────────────────────────

export interface GoalSummary extends Goal {
  fyc_pct: number
  anp_pct: number
}

export interface ClientPipelineSummary {
  client_id:           string
  user_id:             string
  full_name:           string
  status:              ClientStatus
  total_opportunities: number
  total_anp:           number
  total_fyc:           number
  won_fyc:             number
  latest_close_date:   string | null
}

// ─── Supabase Database type map ───────────────────────────────────────────────
// GenericSchema (from @supabase/supabase-js) requires:
//   Tables:    Record<string, { Row, Insert, Update, Relationships: GenericRelationship[] }>
//   Views:     Record<string, { Row, Relationships: GenericRelationship[] }>
//   Functions: Record<string, { Args, Returns }>

type RL = { Relationships: [] }

export interface Database {
  public: {
    Tables: {
      profiles:       { Row: Profile;       Insert: Partial<Profile>;                      Update: Partial<Profile>            } & RL
      tags:           { Row: Tag;           Insert: InsertTag;                             Update: Partial<InsertTag>          } & RL
      clients:        { Row: Client;        Insert: InsertClient;                          Update: UpdateClient                } & RL
      client_tags:    { Row: ClientTag;     Insert: Omit<ClientTag, 'id' | 'created_at'>; Update: Partial<ClientTag>         } & RL
      opportunities:  { Row: Opportunity;   Insert: InsertOpportunity;                     Update: UpdateOpportunity           } & RL
      activities:     { Row: Activity;      Insert: InsertActivity;                        Update: UpdateActivity              } & RL
      notes:          { Row: Note;          Insert: InsertNote;                            Update: UpdateNote                  } & RL
      goals:                   { Row: Goal;              Insert: InsertGoal;              Update: UpdateGoal                       } & RL
      uploaded_files:          { Row: UploadedFile;      Insert: InsertUploadedFile;      Update: Partial<InsertUploadedFile>      } & RL
      client_planning_checklist: { Row: PlanningChecklist; Insert: InsertPlanningChecklist; Update: UpdatePlanningChecklist         } & RL
    }
    Views: {
      goals_summary:           { Row: GoalSummary;           Relationships: [] }
      client_pipeline_summary: { Row: ClientPipelineSummary; Relationships: [] }
    }
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
  }
}
