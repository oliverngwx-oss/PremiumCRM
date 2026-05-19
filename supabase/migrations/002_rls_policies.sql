-- ============================================================
-- Migration 002: Row Level Security (RLS) Policies
-- Enforces strict per-user data isolation on all tables.
-- Apply AFTER 001_create_tables.sql
-- ============================================================

-- ============================================================
-- Enable RLS on every table
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- id IS the user_id (1:1 with auth.users)
-- ============================================================

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profiles are not deleted directly; cascade from auth.users deletion.

-- ============================================================
-- TAGS
-- ============================================================

CREATE POLICY "tags_select_own"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tags_insert_own"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_update_own"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_delete_own"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- CLIENTS
-- ============================================================

CREATE POLICY "clients_select_own"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "clients_insert_own"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_update_own"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_delete_own"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- CLIENT_TAGS
-- Extra guard: user_id must match AND the client must belong
-- to the same user (prevents cross-user tag injection).
-- ============================================================

CREATE POLICY "client_tags_select_own"
  ON client_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "client_tags_insert_own"
  ON client_tags FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM clients c WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM tags t WHERE t.id = tag_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "client_tags_delete_own"
  ON client_tags FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- OPPORTUNITIES
-- Extra guard: client_id must belong to the same user.
-- ============================================================

CREATE POLICY "opportunities_select_own"
  ON opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "opportunities_insert_own"
  ON opportunities FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM clients c WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "opportunities_update_own"
  ON opportunities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "opportunities_delete_own"
  ON opportunities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ACTIVITIES
-- ============================================================

CREATE POLICY "activities_select_own"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "activities_insert_own"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_update_own"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activities_delete_own"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- NOTES
-- ============================================================

CREATE POLICY "notes_select_own"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notes_insert_own"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_update_own"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_delete_own"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- GOALS
-- ============================================================

CREATE POLICY "goals_select_own"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- UPLOADED_FILES
-- ============================================================

CREATE POLICY "uploaded_files_select_own"
  ON uploaded_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "uploaded_files_insert_own"
  ON uploaded_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "uploaded_files_update_own"
  ON uploaded_files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "uploaded_files_delete_own"
  ON uploaded_files FOR DELETE
  USING (auth.uid() = user_id);
