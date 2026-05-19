-- ============================================================
-- Migration 001: Create all CRM tables
-- Apply in Supabase SQL Editor or via Supabase CLI
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search on client names

-- ============================================================
-- UTILITY: updated_at auto-update trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES
-- Extends auth.users with advisor/user metadata.
-- Auto-created on signup via trigger (see 003_functions.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  preferred_name TEXT,
  avatar_url    TEXT,
  role          TEXT DEFAULT 'advisor' CHECK (role IN ('advisor', 'admin', 'manager')),
  company       TEXT,
  phone         TEXT,
  bio           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. TAGS
-- User-defined labels for categorising clients.
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user_id ON tags (user_id);

-- ============================================================
-- 3. CLIENTS
-- Core client/prospect records.
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  full_name           TEXT NOT NULL,
  preferred_name      TEXT,
  email               TEXT,
  phone               TEXT,
  profile_photo_url   TEXT,

  -- Demographics
  age                 INTEGER CHECK (age >= 0 AND age <= 150),
  date_of_birth       DATE,
  occupation          TEXT,
  company             TEXT,
  address             TEXT,
  marital_status      TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'separated', 'other')),
  number_of_children  INTEGER DEFAULT 0 CHECK (number_of_children >= 0),

  -- CRM classification
  client_type         TEXT CHECK (client_type IN ('prospect', 'active', 'vip', 'inactive', 'referral', 'former')),
  source              TEXT CHECK (source IN ('referral', 'warm', 'cold_call', 'social_media', 'event', 'website', 'existing_client', 'walk_in', 'other')),
  status              TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'inactive', 'lost', 'vip')),

  -- Free-form
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id   ON clients (user_id);
CREATE INDEX idx_clients_status    ON clients (status);
CREATE INDEX idx_clients_email     ON clients (user_id, email);
CREATE INDEX idx_clients_fullname  ON clients USING gin (full_name gin_trgm_ops);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. CLIENT_TAGS  (junction table)
-- ============================================================

CREATE TABLE IF NOT EXISTS client_tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, tag_id)
);

CREATE INDEX idx_client_tags_client_id ON client_tags (client_id);
CREATE INDEX idx_client_tags_tag_id    ON client_tags (tag_id);
CREATE INDEX idx_client_tags_user_id   ON client_tags (user_id);

-- ============================================================
-- 5. OPPORTUNITIES
-- Sales pipeline entries linked to a client.
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  title               TEXT NOT NULL,
  product_type        TEXT CHECK (product_type IN (
                        'life_insurance', 'health_insurance', 'investment',
                        'retirement', 'annuity', 'disability', 'critical_illness',
                        'general_insurance', 'other'
                      )),
  stage               TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN (
                        'prospecting', 'qualification', 'proposal',
                        'negotiation', 'closed_won', 'closed_lost'
                      )),

  -- Financials
  estimated_anp       NUMERIC(14, 2) CHECK (estimated_anp >= 0),   -- Annual New Premium
  estimated_fyc       NUMERIC(14, 2) CHECK (estimated_fyc >= 0),   -- First Year Commission
  probability         INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),

  -- Timeline
  expected_close_date DATE,
  next_action         TEXT,
  next_action_date    DATE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunities_user_id   ON opportunities (user_id);
CREATE INDEX idx_opportunities_client_id ON opportunities (client_id);
CREATE INDEX idx_opportunities_stage     ON opportunities (user_id, stage);
CREATE INDEX idx_opportunities_close     ON opportunities (user_id, expected_close_date);

CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. ACTIVITIES
-- Calls, emails, meetings, tasks, follow-ups.
-- ============================================================

CREATE TABLE IF NOT EXISTS activities (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  opportunity_id   UUID REFERENCES opportunities(id) ON DELETE SET NULL,

  type             TEXT NOT NULL CHECK (type IN (
                     'call', 'email', 'meeting', 'task',
                     'follow_up', 'presentation', 'review', 'other'
                   )),
  subject          TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
                     'planned', 'completed', 'cancelled', 'rescheduled'
                   )),

  scheduled_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes >= 0),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id      ON activities (user_id);
CREATE INDEX idx_activities_client_id    ON activities (client_id);
CREATE INDEX idx_activities_scheduled    ON activities (user_id, scheduled_at);
CREATE INDEX idx_activities_status       ON activities (user_id, status);

CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. NOTES
-- Meeting notes, call summaries, general notes per client.
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  activity_id   UUID REFERENCES activities(id) ON DELETE SET NULL,

  title         TEXT,
  content       TEXT NOT NULL,
  meeting_date  DATE,
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id   ON notes (user_id);
CREATE INDEX idx_notes_client_id ON notes (client_id);
CREATE INDEX idx_notes_pinned    ON notes (user_id, is_pinned) WHERE is_pinned = TRUE;

CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. GOALS
-- FYC and ANP targets, tracked monthly / quarterly / annually.
-- Each user sets period targets and can update achieved values.
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Period definition
  period_type     TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  period_year     INTEGER NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month    INTEGER CHECK (period_month >= 1 AND period_month <= 12),   -- set only when monthly
  period_quarter  INTEGER CHECK (period_quarter >= 1 AND period_quarter <= 4), -- set only when quarterly

  -- Targets
  fyc_target      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fyc_target >= 0),
  anp_target      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (anp_target >= 0),

  -- Progress (manually updated or computed by app)
  fyc_achieved    NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fyc_achieved >= 0),
  anp_achieved    NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (anp_achieved >= 0),

  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce correct period fields per type
  CONSTRAINT chk_monthly_period   CHECK (period_type != 'monthly'   OR (period_month IS NOT NULL AND period_quarter IS NULL)),
  CONSTRAINT chk_quarterly_period CHECK (period_type != 'quarterly' OR (period_quarter IS NOT NULL AND period_month IS NULL)),
  CONSTRAINT chk_annual_period    CHECK (period_type != 'annual'    OR (period_month IS NULL AND period_quarter IS NULL)),

  -- One goal row per user per period
  UNIQUE (user_id, period_type, period_year, period_month, period_quarter)
);

CREATE INDEX idx_goals_user_id ON goals (user_id);
CREATE INDEX idx_goals_period  ON goals (user_id, period_type, period_year);

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. UPLOADED_FILES
-- File metadata; binary stored in Supabase Storage bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS uploaded_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,           -- original filename
  storage_path  TEXT NOT NULL,           -- path inside Supabase Storage bucket
  size_bytes    BIGINT CHECK (size_bytes >= 0),
  mime_type     TEXT,
  description   TEXT,
  category      TEXT CHECK (category IN (
                  'kyc', 'proposal', 'policy', 'id_document',
                  'financial_statement', 'correspondence', 'other'
                )),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploaded_files_user_id   ON uploaded_files (user_id);
CREATE INDEX idx_uploaded_files_client_id ON uploaded_files (client_id);

CREATE TRIGGER trg_uploaded_files_updated_at
  BEFORE UPDATE ON uploaded_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
