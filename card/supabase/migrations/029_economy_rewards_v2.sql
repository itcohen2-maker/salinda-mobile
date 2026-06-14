-- ============================================================
-- 029_economy_rewards_v2.sql
-- Economy redesign Phase 1: allow the new per-game reward sources
-- (participation, session momentum) and wire first-win-of-day with a
-- SERVER-side UTC date so timezone changes can't farm the daily bonus.
-- The coin_events.source CHECK is a closed allowlist (see 019/026).
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
    'gold_room_complete',
    'game_participation',
    'first_win_of_day',
    'session_momentum'
  ));

-- First-win-of-day: idempotent per (player, UTC date). The idempotency key is
-- computed server-side from current_date, so the client cannot game it by
-- changing the device clock/timezone. Safe to call on every human win; only the
-- first call per UTC day inserts a row (enforced by the unique index from 019).
create or replace function public.award_first_win_of_day(
  p_amount integer
) returns void as $$
declare
  v_player_id uuid := auth.uid();
  v_key       text := 'first_win_of_day:' || to_char(current_date, 'YYYY-MM-DD');
begin
  if v_player_id is null then return; end if;
  if p_amount <= 0 then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = v_player_id
      and source = 'first_win_of_day'
      and idempotency_key = v_key
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id, idempotency_key)
  values (v_player_id, p_amount, 'first_win_of_day', null, v_key);

  update public.profiles
  set total_coins = greatest(0, total_coins + p_amount)
  where id = v_player_id;
exception
  when unique_violation then
    return;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.award_first_win_of_day(integer) to authenticated, anon;
