-- ============================================================
-- Migration 004: Optional seed data (run manually if desired)
-- Creates a demo set of default pipeline stages and tag colours.
-- This file does NOT insert user-specific data.
-- ============================================================

-- Default opportunity stages are enforced via CHECK constraint.
-- No seed needed for stages — they are enum-style values.

-- Example: insert default goals for the currently logged-in user
-- (run this in the app layer, not as a migration):
--
-- INSERT INTO goals (user_id, period_type, period_year, period_month, fyc_target, anp_target)
-- VALUES
--   (auth.uid(), 'monthly', 2025, 1, 5000, 20000),
--   (auth.uid(), 'monthly', 2025, 2, 5000, 20000),
--   ...
--   (auth.uid(), 'quarterly', 2025, NULL, 15000, 60000) -- period_quarter = 1
--   (auth.uid(), 'annual', 2025, NULL, 60000, 240000);

-- ============================================================
-- HELPFUL QUERIES (for reference)
-- ============================================================

-- Get all goals for current user this year:
-- SELECT * FROM goals WHERE user_id = auth.uid() AND period_year = 2025;

-- Get pipeline summary for current user:
-- SELECT * FROM client_pipeline_summary WHERE user_id = auth.uid();

-- Get clients with their tags:
-- SELECT c.*, array_agg(t.name) as tags
-- FROM clients c
-- LEFT JOIN client_tags ct ON ct.client_id = c.id
-- LEFT JOIN tags t ON t.id = ct.tag_id
-- WHERE c.user_id = auth.uid()
-- GROUP BY c.id;

-- Get activities due this week:
-- SELECT a.*, c.full_name as client_name
-- FROM activities a
-- LEFT JOIN clients c ON c.id = a.client_id
-- WHERE a.user_id = auth.uid()
--   AND a.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
--   AND a.status = 'planned'
-- ORDER BY a.scheduled_at;
