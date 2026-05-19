-- Add 'warm' to clients source check constraint
ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_source_check,
  ADD CONSTRAINT clients_source_check
    CHECK (source IN ('referral', 'warm', 'cold_call', 'social_media', 'event', 'website', 'existing_client', 'walk_in', 'other'));
