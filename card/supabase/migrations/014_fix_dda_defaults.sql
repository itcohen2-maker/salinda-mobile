-- 014_fix_dda_defaults.sql
--
-- Fix 1: Backfill existing users.
--   Migration 013 added is_first_game with DEFAULT true, which correctly marks
--   NEW accounts as first-timers. However, every *existing* row in the table
--   also received true. This resets veterans (any account that already played
--   at least one recorded match) back to false.
--
UPDATE profiles
SET is_first_game = false
WHERE wins > 0 OR losses > 0 OR abandons > 0;

-- Fix 2: Atomic loss-streak increment.
--   The application code uses a read-modify-write pattern (SELECT + UPDATE) to
--   increment loss_streak, which is vulnerable to a race when two matches for
--   the same user finish concurrently. This function performs an atomic UPDATE
--   directly in Postgres, eliminating the race.
CREATE OR REPLACE FUNCTION increment_loss_streak(uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE profiles
  SET loss_streak = loss_streak + 1,
      is_first_game = false
  WHERE id = uid;
$$;

GRANT EXECUTE ON FUNCTION increment_loss_streak(uuid) TO service_role;
