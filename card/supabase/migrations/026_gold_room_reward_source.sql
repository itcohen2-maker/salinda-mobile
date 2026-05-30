-- ============================================================
-- 026_gold_room_reward_source.sql
-- Allow the Gold Room one-time "collect coins" reward source.
-- The coin_events.source CHECK is a closed allowlist (see 019), so a
-- new reward source must be added here or award_coins() rejects it.
-- Server-side single-grant is already guaranteed: award_coins() with a
-- null match_id + null idempotency_key returns early if a row with the
-- same (player_id, source) already exists, so a player can collect once.
-- ============================================================

alter table public.coin_events
  drop constraint if exists coin_events_source_check;

alter table public.coin_events
  add constraint coin_events_source_check
  check (source in (
    'game_courage',
    'game_standard_win',
    'game_perfect_win',
    'excellence_meter_full',
    'tutorial_core',
    'tutorial_advanced',
    'tutorial_legacy',
    'gold_room_complete'
  ));
