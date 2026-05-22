-- Migration 009: Retirement Report tables
-- Adds client_retirement_profile (inputs & assumptions) and
-- client_retirement_action_items (checklist with custom items).

-- ─── client_retirement_profile ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_retirement_profile (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id                 uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Basic retirement info
  target_retirement_age     smallint,
  life_expectancy           smallint DEFAULT 85,
  current_monthly_expenses  numeric(12,2),
  retirement_monthly_needs  numeric(12,2),
  inflation_rate            numeric(5,4) DEFAULT 0.03,
  expected_return_rate      numeric(5,4) DEFAULT 0.05,

  -- Current assets
  current_savings           numeric(12,2) DEFAULT 0,
  cpf_ordinary_account      numeric(12,2) DEFAULT 0,
  cpf_special_account       numeric(12,2) DEFAULT 0,
  cpf_medisave_account      numeric(12,2) DEFAULT 0,
  investment_portfolio      numeric(12,2) DEFAULT 0,
  property_value            numeric(12,2) DEFAULT 0,
  property_mortgage_outstanding numeric(12,2) DEFAULT 0,
  other_assets              numeric(12,2) DEFAULT 0,

  -- Income sources in retirement
  cpf_life_monthly          numeric(10,2) DEFAULT 0,
  rental_income_monthly     numeric(10,2) DEFAULT 0,
  part_time_income_monthly  numeric(10,2) DEFAULT 0,
  other_income_monthly      numeric(10,2) DEFAULT 0,

  -- Monthly contributions
  monthly_savings_contribution  numeric(10,2) DEFAULT 0,
  monthly_cpf_employee          numeric(10,2) DEFAULT 0,
  monthly_cpf_employer          numeric(10,2) DEFAULT 0,
  monthly_investment_contribution numeric(10,2) DEFAULT 0,

  -- Asset allocation (percentages, should sum to 100)
  alloc_equities            smallint DEFAULT 0,
  alloc_bonds               smallint DEFAULT 0,
  alloc_cash                smallint DEFAULT 0,
  alloc_property            smallint DEFAULT 0,
  alloc_cpf                 smallint DEFAULT 0,
  alloc_others              smallint DEFAULT 0,

  -- Advisor notes & summary
  advisor_notes             text,
  advisor_notes_category    text DEFAULT 'general',
  advisor_summary           text,

  -- Readiness score (computed, cached)
  readiness_score           smallint,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, client_id)
);

-- ─── client_retirement_action_items ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_retirement_action_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label        text NOT NULL,
  category     text NOT NULL DEFAULT 'general',
  is_completed boolean NOT NULL DEFAULT false,
  is_custom    boolean NOT NULL DEFAULT false,
  sort_order   smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

CREATE TRIGGER set_retirement_profile_updated_at
  BEFORE UPDATE ON client_retirement_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_retirement_action_items_updated_at
  BEFORE UPDATE ON client_retirement_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE client_retirement_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_retirement_action_items ENABLE ROW LEVEL SECURITY;

-- client_retirement_profile
CREATE POLICY "Users manage own retirement profiles"
  ON client_retirement_profile FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- client_retirement_action_items
CREATE POLICY "Users manage own retirement action items"
  ON client_retirement_action_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
