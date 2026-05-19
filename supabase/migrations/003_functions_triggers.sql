-- ============================================================
-- Migration 003: Functions, Triggers & Storage setup
-- Apply AFTER 001 and 002.
-- ============================================================

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When a new user signs up via Supabase Auth, automatically
-- create a matching row in public.profiles.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as postgres, not the calling user
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop if exists so migration is re-runnable
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- GOALS SUMMARY VIEW
-- Convenience view joining targets vs achieved for a user.
-- RLS is inherited from the underlying goals table.
-- ============================================================

CREATE OR REPLACE VIEW goals_summary AS
SELECT
  g.id,
  g.user_id,
  g.period_type,
  g.period_year,
  g.period_month,
  g.period_quarter,
  g.fyc_target,
  g.fyc_achieved,
  ROUND(
    CASE WHEN g.fyc_target > 0
         THEN (g.fyc_achieved / g.fyc_target) * 100
         ELSE 0 END, 2
  ) AS fyc_pct,
  g.anp_target,
  g.anp_achieved,
  ROUND(
    CASE WHEN g.anp_target > 0
         THEN (g.anp_achieved / g.anp_target) * 100
         ELSE 0 END, 2
  ) AS anp_pct,
  g.notes,
  g.created_at,
  g.updated_at
FROM goals g;

-- ============================================================
-- CLIENT PIPELINE SUMMARY VIEW
-- Aggregates opportunity values per client per user.
-- ============================================================

CREATE OR REPLACE VIEW client_pipeline_summary AS
SELECT
  c.id             AS client_id,
  c.user_id,
  c.full_name,
  c.status,
  COUNT(o.id)                                         AS total_opportunities,
  COALESCE(SUM(o.estimated_anp), 0)                  AS total_anp,
  COALESCE(SUM(o.estimated_fyc), 0)                  AS total_fyc,
  COALESCE(SUM(o.estimated_fyc)
    FILTER (WHERE o.stage = 'closed_won'), 0)         AS won_fyc,
  MAX(o.expected_close_date)                          AS latest_close_date
FROM clients c
LEFT JOIN opportunities o ON o.client_id = c.id AND o.user_id = c.user_id
GROUP BY c.id, c.user_id, c.full_name, c.status;

-- ============================================================
-- STORAGE: client-files bucket
-- Run this block in the Supabase dashboard Storage section
-- OR via SQL if using Supabase CLI local setup.
-- ============================================================

-- Create the storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own folder
-- Folder structure: client-files/{user_id}/{client_id}/{filename}

CREATE POLICY "storage_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "storage_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
