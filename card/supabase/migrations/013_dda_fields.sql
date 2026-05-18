-- 013_dda_fields.sql
-- Adds hidden DDA tracking fields to player profiles.
-- loss_streak: incremented on loss, reset to 0 on win.
-- is_first_game: true until first completed match (any result).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loss_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_first_game bool NOT NULL DEFAULT true;
