-- ============================================================
-- Migration 006: Update opportunity pipeline stages
-- Old: prospecting, qualification, proposal, negotiation, closed_won, closed_lost
-- New: new_lead, contacted, appointment_set, fact_find, proposal,
--      closing, won, lost, follow_up_later
-- ============================================================

-- Step 1: Temporarily drop the CHECK constraint
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- Step 2: Migrate existing rows to new stage values before adding the new constraint
UPDATE opportunities SET stage = 'new_lead'         WHERE stage = 'prospecting';
UPDATE opportunities SET stage = 'contacted'         WHERE stage = 'qualification';
UPDATE opportunities SET stage = 'closing'           WHERE stage = 'negotiation';
UPDATE opportunities SET stage = 'won'               WHERE stage = 'closed_won';
UPDATE opportunities SET stage = 'lost'              WHERE stage = 'closed_lost';
-- 'proposal' is unchanged

-- Step 3: Add new constraint
ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'new_lead', 'contacted', 'appointment_set', 'fact_find',
    'proposal', 'closing', 'won', 'lost', 'follow_up_later'
  ));

-- Step 4: Update default
ALTER TABLE opportunities ALTER COLUMN stage SET DEFAULT 'new_lead';

-- Step 5: Refresh client_pipeline_summary view to use new stage name
CREATE OR REPLACE VIEW client_pipeline_summary AS
SELECT
  c.id             AS client_id,
  c.user_id,
  c.full_name,
  c.status,
  COALESCE(COUNT(o.id), 0)                                         AS total_opportunities,
  COALESCE(SUM(o.estimated_anp), 0)                                AS total_anp,
  COALESCE(SUM(o.estimated_fyc), 0)                                AS total_fyc,
  COALESCE(SUM(o.estimated_fyc) FILTER (WHERE o.stage = 'won'), 0) AS won_fyc,
  MAX(o.expected_close_date)                                        AS latest_close_date
FROM clients c
LEFT JOIN opportunities o ON o.client_id = c.id AND o.user_id = c.user_id
GROUP BY c.id, c.user_id, c.full_name, c.status;
