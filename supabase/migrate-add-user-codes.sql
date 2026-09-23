-- ═══════════════════════════════════════════════════════════════════════════
-- USER CODES — a short public identifier for every account.
--
-- Shown on the dashboard for the user to copy and share. It is what another
-- user will send money to once internal transfers exist, so it must be
-- readable out loud and typed without mistakes:
--
--   • alphanumeric only, no punctuation
--   • uppercase, so case never matters
--   • the alphabet excludes 0/O and 1/I/L, the characters people misread
--   • RYD prefix makes it recognisable as a Rydvest code
--
-- e.g. RYD7K2M9X, RYDH4TBQ3
--
-- Safe to re-run: the column, the backfill and the trigger are all guarded.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists user_code text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Generator. 32^6 ≈ 1.07 billion codes; the caller retries on the (unlikely)
-- collision rather than relying on a single attempt.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.generate_user_code()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_len      constant int  := length(v_alphabet);
  v_code     text;
  v_i        int;
begin
  loop
    v_code := 'RYD';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_len)::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where user_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill every existing account, then lock the column down.
-- ─────────────────────────────────────────────────────────────────────────────
do $backfill$
declare
  v_id uuid;
begin
  for v_id in select id from public.profiles where user_code is null loop
    update public.profiles set user_code = public.generate_user_code() where id = v_id;
  end loop;
end
$backfill$;

alter table public.profiles alter column user_code set not null;

create unique index if not exists profiles_user_code_key on public.profiles (user_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assign one to every new account. BEFORE INSERT on profiles catches every
-- path — the signup trigger, an admin insert, a manual backfill — rather than
-- only the signup flow.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_user_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_code is null or btrim(new.user_code) = '' then
    new.user_code := public.generate_user_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_user_code on public.profiles;
create trigger profiles_set_user_code
  before insert on public.profiles
  for each row execute function public.set_user_code();

-- ─────────────────────────────────────────────────────────────────────────────
-- The code is public within Rydvest (it is how users address each other), but
-- it must never be writable by the user who owns it.
-- ─────────────────────────────────────────────────────────────────────────────
revoke update (user_code) on public.profiles from authenticated;
