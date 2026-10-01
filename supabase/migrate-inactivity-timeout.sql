-- ═══════════════════════════════════════════════════════════════════════════
-- INACTIVITY TIMEOUT — enforced in the database.
--
-- Supabase refresh tokens never expire by default, and the Sessions settings
-- that would time-box them (Time-box user sessions / Inactivity timeout) are
-- not available on the Free plan. So we track activity ourselves.
--
-- Why the database and not a cookie: anything the browser holds, the browser
-- can edit. A stale session must be rejected on evidence the client cannot
-- rewrite, so the last-seen timestamp lives on the profile row and the decision
-- is made here.
--
-- touch_session() does the check and the update in one round trip:
--   • idle longer than the window  → returns expired, does NOT extend
--   • otherwise                    → stamps now() and returns ok
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists last_active_at timestamptz;

-- Existing sessions start their clock now rather than being logged out at once.
update public.profiles set last_active_at = now() where last_active_at is null;

create or replace function public.touch_session(p_timeout_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_last timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- A zero or negative window disables the timeout entirely.
  if p_timeout_minutes is null or p_timeout_minutes <= 0 then
    update public.profiles set last_active_at = now() where id = v_uid;
    return jsonb_build_object('ok', true, 'reason', 'disabled');
  end if;

  select last_active_at into v_last from public.profiles where id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  if v_last is not null and v_last < now() - make_interval(mins => p_timeout_minutes) then
    -- Deliberately does not extend: an expired session must stay expired even
    -- if the request is retried.
    return jsonb_build_object('ok', false, 'reason', 'idle_timeout', 'last_active_at', v_last);
  end if;

  update public.profiles set last_active_at = now() where id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- Users call this with their own session; it only ever touches their own row.
grant execute on function public.touch_session(int) to authenticated;

-- last_active_at is maintained by the function above, never by the client.
revoke update (last_active_at) on public.profiles from authenticated;
