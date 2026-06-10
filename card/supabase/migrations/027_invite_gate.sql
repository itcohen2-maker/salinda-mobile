-- ============================================================
-- 027_invite_gate.sql
-- Closed invite gate ("Remote Control" / שלט רחוק).
--
-- The whole product becomes a closed beta: nobody sees the game.
-- Only emails the admin pre-approves (by Google account email) get in.
-- The admin invites / disconnects / restores users and tunes the
-- client re-check interval, all from the in-app Remote Control screen.
--
-- Security model: enforcement lives in the data layer, not just the UI.
--   * invited_users / app_config are admin-only via RLS.
--   * Users never read invited_users directly — they call the
--     check_invite_access() RPC which returns ONLY their own status.
--   * The socket server (authMiddleware.ts) repeats this check so a
--     blocked/non-invited account cannot perform online actions even
--     if it bypasses the front-end gate.
-- ============================================================

-- ── invited_users: the allowlist ──────────────────────────────
create table if not exists public.invited_users (
  email text primary key,
  status text not null default 'invited' check (status in ('invited', 'blocked')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  first_login_at timestamptz,
  last_seen_at timestamptz
);

create index if not exists idx_invited_users_status
  on public.invited_users (status);

alter table public.invited_users enable row level security;

-- Only admins can read/write the raw allowlist.
drop policy if exists "Admins read invited users" on public.invited_users;
create policy "Admins read invited users"
  on public.invited_users
  for select
  to authenticated
  using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

grant select on public.invited_users to authenticated;
grant select, insert, update, delete on public.invited_users to service_role;

-- ── app_config: admin-editable global settings (key/value) ────
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_config enable row level security;

-- Any signed-in client may READ config (the gate needs the re-check interval)...
drop policy if exists "Authenticated read app config" on public.app_config;
create policy "Authenticated read app config"
  on public.app_config
  for select
  to authenticated
  using (true);

grant select on public.app_config to authenticated;
grant select, insert, update, delete on public.app_config to service_role;

-- Seed the re-check defaults (30s poll, no grace period).
insert into public.app_config (key, value)
values ('gate_recheck', jsonb_build_object('intervalSeconds', 30, 'graceSeconds', 0))
on conflict (key) do nothing;

-- ── is_invited(): reusable helper (email-based allowlist check) ─
-- security definer so it can read invited_users + auth.users regardless
-- of the caller's RLS. Returns true only for a non-blocked invited email.
create or replace function public.is_invited(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.invited_users iv
      on lower(iv.email) = lower(u.email)
    where u.id = p_user_id
      and iv.status = 'invited'
  );
$$;

grant execute on function public.is_invited(uuid) to authenticated;

-- ── check_invite_access(): per-user gate check (client-facing) ─
-- Returns ONLY the calling user's own status. Also stamps presence
-- (first_login_at / last_seen_at) so the admin analytics panel can
-- show who is currently connected.
create or replace function public.check_invite_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_status text;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'status', 'anonymous');
  end if;

  -- Admins always pass the gate so they can never lock themselves out.
  if exists (select 1 from public.admin_users a where a.user_id = v_uid) then
    return jsonb_build_object('allowed', true, 'status', 'admin');
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    return jsonb_build_object('allowed', false, 'status', 'no_email');
  end if;

  select iv.status into v_status
  from public.invited_users iv
  where lower(iv.email) = lower(v_email);

  if v_status is null then
    return jsonb_build_object('allowed', false, 'status', 'not_invited');
  end if;

  if v_status = 'blocked' then
    return jsonb_build_object('allowed', false, 'status', 'blocked');
  end if;

  -- Invited & allowed → record presence.
  update public.invited_users
     set last_seen_at = now(),
         first_login_at = coalesce(first_login_at, now())
   where lower(email) = lower(v_email);

  return jsonb_build_object('allowed', true, 'status', 'invited');
end;
$$;

grant execute on function public.check_invite_access() to authenticated;

-- ── admin_set_invite(): add / block / restore an email ─────────
create or replace function public.admin_set_invite(
  p_email text,
  p_status text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_uid is null
     or not exists (select 1 from public.admin_users a where a.user_id = v_uid) then
    return 'forbidden';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return 'invalid_email';
  end if;

  if p_status not in ('invited', 'blocked') then
    return 'invalid_status';
  end if;

  insert into public.invited_users (email, status, invited_by)
  values (v_email, p_status, v_uid)
  on conflict (email) do update
    set status = excluded.status;

  return 'ok';
end;
$$;

grant execute on function public.admin_set_invite(text, text) to authenticated;

-- ── admin_set_config(): write an app_config key ────────────────
create or replace function public.admin_set_config(
  p_key text,
  p_value jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
     or not exists (select 1 from public.admin_users a where a.user_id = v_uid) then
    return 'forbidden';
  end if;

  if p_key is null or trim(p_key) = '' then
    return 'invalid_key';
  end if;

  insert into public.app_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), v_uid)
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now(),
        updated_by = v_uid;

  return 'ok';
end;
$$;

grant execute on function public.admin_set_config(text, jsonb) to authenticated;

-- ── get_invite_analytics(): admin monitoring panel data ────────
-- Counts + per-invite rows for the "invited only" Analytics section.
-- "online" = invited, not blocked, seen within live_window_seconds.
create or replace function public.get_invite_analytics(
  live_window_seconds int default 90
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'total_invited', (select count(*) from public.invited_users where status = 'invited'),
    'total_blocked', (select count(*) from public.invited_users where status = 'blocked'),
    'online_now', (
      select count(*) from public.invited_users
      where status = 'invited'
        and last_seen_at > now() - (live_window_seconds || ' seconds')::interval
    ),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', email,
        'status', status,
        'first_login_at', first_login_at,
        'last_seen_at', last_seen_at,
        'online', (status = 'invited'
          and last_seen_at > now() - (live_window_seconds || ' seconds')::interval)
      ) order by last_seen_at desc nulls last)
      from public.invited_users
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_invite_analytics(int) to authenticated;
