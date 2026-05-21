-- ============================================================
-- 017_admin_coin_gifts.sql
-- Admin-only coin gifting with audit logging.
-- ============================================================

alter table public.coin_events
  drop constraint if exists coin_events_source_check;

alter table public.coin_events
  add constraint coin_events_source_check
  check (source in (
    'game_courage',
    'tutorial_core',
    'tutorial_advanced',
    'tutorial_legacy',
    'admin_gift'
  ));

create table if not exists public.admin_coin_grants (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  admin_username_snapshot text not null,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_username_snapshot text not null,
  amount integer not null check (amount > 0),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_coin_grants_created_at
  on public.admin_coin_grants (created_at desc);

create index if not exists idx_admin_coin_grants_target_created_at
  on public.admin_coin_grants (target_user_id, created_at desc);

alter table public.admin_coin_grants enable row level security;

drop policy if exists "Admins read admin coin grants"
  on public.admin_coin_grants;

create policy "Admins read admin coin grants"
  on public.admin_coin_grants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users admins
      where admins.user_id = auth.uid()
    )
  );

grant select on public.admin_coin_grants to authenticated;
grant select, insert, update, delete on public.admin_coin_grants to service_role;

create or replace function public.admin_grant_coins(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text default ''
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_user_id uuid := auth.uid();
  v_admin_username text;
  v_target_username text;
  v_reason text := left(coalesce(trim(p_reason), ''), 200);
begin
  if v_admin_user_id is null then
    return 'forbidden';
  end if;

  if not exists (
    select 1
    from public.admin_users admins
    where admins.user_id = v_admin_user_id
  ) then
    return 'forbidden';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    return 'invalid_amount';
  end if;

  select username
    into v_admin_username
    from public.profiles
   where id = v_admin_user_id;

  select username
    into v_target_username
    from public.profiles
   where id = p_target_user_id;

  if v_target_username is null then
    return 'target_not_found';
  end if;

  insert into public.coin_events (player_id, amount, source, match_id)
  values (p_target_user_id, p_amount, 'admin_gift', null);

  update public.profiles
     set total_coins = total_coins + p_amount
   where id = p_target_user_id;

  insert into public.admin_coin_grants (
    admin_user_id,
    admin_username_snapshot,
    target_user_id,
    target_username_snapshot,
    amount,
    reason
  )
  values (
    v_admin_user_id,
    coalesce(v_admin_username, 'unknown_admin'),
    p_target_user_id,
    v_target_username,
    p_amount,
    v_reason
  );

  return 'ok';
end;
$$;

grant execute on function public.admin_grant_coins(uuid, integer, text) to authenticated;
