-- ============================================================
-- 019_gameplay_reward_sources.sql
-- Allow explicit gameplay reward sources and add a text
-- idempotency key for replayable local win rewards.
-- ============================================================

alter table public.coin_events
  add column if not exists idempotency_key text;

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
    'tutorial_legacy'
  ));

create unique index if not exists idx_coin_events_player_source_key
  on public.coin_events (player_id, source, idempotency_key)
  where idempotency_key is not null;

drop function if exists public.award_coins_for_player(uuid, integer, text, uuid);
drop function if exists public.award_coins(integer, text, uuid);

create or replace function public.award_coins_for_player(
  p_player_id        uuid,
  p_amount           integer,
  p_source           text,
  p_match_id         uuid default null,
  p_idempotency_key  text default null
) returns void as $$
begin
  if p_amount <= 0 then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = p_player_id
      and source = p_source
      and (
        (p_idempotency_key is not null and idempotency_key = p_idempotency_key)
        or (
          p_idempotency_key is null
          and (match_id = p_match_id or (match_id is null and p_match_id is null))
        )
      )
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id, idempotency_key)
  values (p_player_id, p_amount, p_source, p_match_id, p_idempotency_key);

  update public.profiles
  set total_coins = greatest(0, total_coins + p_amount)
  where id = p_player_id;
exception
  when unique_violation then
    return;
end;
$$ language plpgsql;

create or replace function public.award_coins(
  p_amount           integer,
  p_source           text,
  p_match_id         uuid default null,
  p_idempotency_key  text default null
) returns void as $$
declare
  v_player_id uuid := auth.uid();
begin
  if v_player_id is null then return; end if;
  if p_amount <= 0 then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = v_player_id
      and source = p_source
      and (
        (p_idempotency_key is not null and idempotency_key = p_idempotency_key)
        or (
          p_idempotency_key is null
          and (match_id = p_match_id or (match_id is null and p_match_id is null))
        )
      )
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id, idempotency_key)
  values (v_player_id, p_amount, p_source, p_match_id, p_idempotency_key);

  update public.profiles
  set total_coins = greatest(0, total_coins + p_amount)
  where id = v_player_id;
exception
  when unique_violation then
    return;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.award_coins(integer, text, uuid, text) to authenticated, anon;
grant execute on function public.award_coins_for_player(uuid, integer, text, uuid, text) to service_role;
