-- ═══════════════════════════════════════════════════════════════════════════
-- SIGN-IN HISTORY — so "was that you?" has an answer.
--
-- The sign-in notice email already tells somebody their account was used, but
-- it is written and then forgotten: nothing is kept, so neither the owner nor
-- an admin can answer the question that matters afterwards — is this address
-- and this phone the same one as always, or did something change on Tuesday?
--
-- Every completed sign-in now leaves a row, and record_sign_in() reports
-- whether that address and that device had ever been seen on the account
-- before. That judgement is made HERE rather than in the app, in the same
-- statement that writes the row, because it has to be made against what was
-- true a moment before the insert — do it afterwards and every sign-in looks
-- familiar, because it has just made itself familiar.
--
-- WHAT THIS IS NOT
--   It is not an access control. Nothing is blocked on the strength of a new
--   address, and nothing should be: people travel, phones change network, and
--   a Nigerian mobile IP can move between states inside an hour. It is
--   evidence for a human to read, and the alarm it raises goes to the account
--   owner, who is the only one who actually knows.
--
--   The values are read from request headers, which the client ultimately
--   controls. Good enough to recognise your own phone; not proof of anything.
--
-- PRIVACY
--   An IP address is personal data. Rows are kept for 90 days and then
--   deleted by expire_sign_in_events(), called from the nightly cron. Long
--   enough to investigate a dispute, short enough that we are not quietly
--   building a movement history of every customer.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE LOG
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sign_in_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- Nullable throughout: behind an unusual proxy we genuinely do not know,
  -- and a row that says so is worth more than no row at all.
  ip          text,
  location    text,
  device      text,
  user_agent  text,
  -- What record_sign_in() concluded at the moment it was written. Stored
  -- rather than recomputed, so the history cannot change under later rows.
  new_ip      boolean not null default false,
  new_device  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists sign_in_events_user_idx
  on public.sign_in_events (user_id, created_at desc);

-- Used by the "have we seen this before?" lookups below.
create index if not exists sign_in_events_user_ip_idx
  on public.sign_in_events (user_id, ip);

alter table public.sign_in_events enable row level security;

-- Your own history, or an admin looking at anybody's. There is deliberately
-- no insert, update or delete policy: the only way a row is written is the
-- SECURITY DEFINER function below, called with the service key. Nobody can
-- forge a sign-in or erase one through the API — least of all somebody who
-- has just taken over an account and would like the evidence gone.
drop policy if exists "sign_in_events: read own or admin" on public.sign_in_events;
create policy "sign_in_events: read own or admin" on public.sign_in_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.sign_in_events from public, anon;
grant select on public.sign_in_events to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECORD ONE, AND SAY WHETHER IT IS NEW
--
-- Returns the two flags so the notice email can lead with "a device we have
-- not seen before" instead of the same sentence every time. An email that
-- says something different when something IS different is the one people
-- actually read.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_sign_in(
  p_user_id    uuid,
  p_ip         text default null,
  p_location   text default null,
  p_device     text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seen_before  boolean;
  v_new_ip       boolean := false;
  v_new_device   boolean := false;
begin
  -- Has this account ever been signed into at all? A first sign-in is not a
  -- suspicious one, and flagging it as "new device" on the day somebody joins
  -- teaches them to ignore the warning.
  select exists (
    select 1 from public.sign_in_events where user_id = p_user_id
  ) into v_seen_before;

  if v_seen_before then
    if p_ip is not null then
      select not exists (
        select 1 from public.sign_in_events
        where user_id = p_user_id and ip = p_ip
      ) into v_new_ip;
    end if;

    if p_device is not null then
      select not exists (
        select 1 from public.sign_in_events
        where user_id = p_user_id and device = p_device
      ) into v_new_device;
    end if;
  end if;

  insert into public.sign_in_events
    (user_id, ip, location, device, user_agent, new_ip, new_device)
  values
    (p_user_id, p_ip, p_location, p_device, p_user_agent, v_new_ip, v_new_device);

  return jsonb_build_object(
    'ok', true,
    'first_sign_in', not v_seen_before,
    'new_ip', v_new_ip,
    'new_device', v_new_device
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RETENTION
--
-- Ninety days. Called from the nightly cleanup cron; also safe to run by hand.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.expire_sign_in_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.sign_in_events
  where created_at < now() - interval '90 days';

  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GRANTS
--
-- Both functions are service-role only. record_sign_in() writes history, so a
-- caller who could reach it could bury a real sign-in under invented ones;
-- expire_sign_in_events() deletes it outright.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.record_sign_in(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.expire_sign_in_events()
  from public, anon, authenticated;

grant execute on function public.record_sign_in(uuid, text, text, text, text)
  to service_role;
grant execute on function public.expire_sign_in_events() to service_role;
