-- ═══════════════════════════════════════════════════════════════════════════
-- INTERNAL TRANSFERS — moving balance from one Rydvest account to another by
-- account ID (RYDxxxxxx).
--
-- The whole transfer happens inside transfer_to_user(): one transaction, both
-- profile rows locked, every rule checked under that lock. Nothing in the app
-- layer can let a transfer through that this function would refuse, and a
-- crash halfway leaves no half-moved money.
--
-- WHY THE BALANCE IS NOT A COLUMN
--   available_balance() derives the figure from the tables that caused it, so
--   there is no stored number to drift. That means a transfer has to be
--   subtracted from the sender and added to the recipient IN THAT FUNCTION —
--   which is why this migration redefines it. Forgetting that step would have
--   created money out of nothing.
--
-- THE RULES, ALL ENFORCED HERE
--   • sender must be logged in, not locked, and KYC-approved
--   • recipient must exist, not be locked, and not be the sender
--   • amount: whole naira, at least the minimum, at most the per-transfer cap
--   • sender must have the money, counting transfers already sent
--   • per-hour count cap and per-day value cap, both per sender
--   • account-ID lookups are rate limited, so the ID space cannot be swept
--
-- ⚠ RUN ORDER: after migrate-add-user-codes.sql (profiles.user_code),
--   migrate-user-lock.sql (is_locked) and migrate-kyc.sql (has_approved_kyc).
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LIMITS — one place to change them. Mirrored by lib/economics.ts for the
--    form's own hints; these are what actually bind.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_limits()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'min_amount',      100,        -- smallest transfer
    'max_amount',      2000000,    -- most that can go in one transfer
    'max_per_day',     5000000,    -- most that can be sent in 24 hours
    'max_per_hour',    10,         -- transfers per hour
    'max_lookups_hour', 30         -- account-ID lookups per hour
  );
$$;

grant execute on function public.transfer_limits() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. THE LEDGER OF TRANSFERS
--
-- Both sides are recorded on one row, so a transfer can never exist for the
-- sender but not the recipient. The reference is what each party sees.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.transfers (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id),
  recipient_id uuid not null references public.profiles (id),
  amount       numeric(14,2) not null check (amount > 0),
  reference    text not null unique,
  note         text,
  created_at   timestamptz not null default now(),
  -- Belt and braces: the function refuses this too, but a self-transfer would
  -- be a free no-op that still cluttered both statements.
  constraint transfers_not_self check (sender_id <> recipient_id)
);

create index if not exists transfers_sender_idx    on public.transfers (sender_id, created_at desc);
create index if not exists transfers_recipient_idx on public.transfers (recipient_id, created_at desc);

alter table public.transfers enable row level security;

drop policy if exists "transfers: read own or admin" on public.transfers;
create policy "transfers: read own or admin" on public.transfers
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

-- No insert/update/delete policy at all: the only way in is the SECURITY
-- DEFINER function below, and the only way to correct one is an admin with the
-- service key. Transfers are not editable by anybody through the API.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LOOKUP LOG — what makes the rate limit on account-ID lookups possible,
--    and leaves a trail if somebody tries to sweep the ID space anyway.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.code_lookups (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  code       text not null,
  found      boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists code_lookups_user_idx on public.code_lookups (user_id, created_at desc);

alter table public.code_lookups enable row level security;
-- Readable by admins only; it exists for the rate limiter and for forensics.
drop policy if exists "code_lookups: admin reads" on public.code_lookups;
create policy "code_lookups: admin reads" on public.code_lookups
  for select to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THE LEDGER GAINS TWO TYPES
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in (
    'investment', 'payout', 'withdrawal', 'refund', 'deposit',
    'transfer_in', 'transfer_out'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BALANCE — now aware of money moved between accounts.
--
-- Reproduced in full from migrate-monnify-to-korapay.sql with the two transfer
-- terms added. Every other term is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.available_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((
      select sum(credited_amount) from public.deposits
      where user_id = p_user_id and status = 'credited'
    ), 0)
  + coalesce((
      select sum(amount) from public.payouts
      where user_id = p_user_id and status = 'paid'
    ), 0)
  + coalesce((
      select sum(amount) from public.transfers
      where recipient_id = p_user_id
    ), 0)
  - coalesce((
      select sum(amount) from public.transfers
      where sender_id = p_user_id
    ), 0)
  - coalesce((
      select sum(amount) from public.investments
      where user_id = p_user_id and funding = 'balance' and status in ('paid', 'refund_pending')
    ), 0)
  - coalesce((
      select sum(amount) from public.withdrawals
      where user_id = p_user_id and status in ('pending', 'approved', 'paid')
    ), 0);
$$;

grant execute on function public.available_balance(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. NORMALISE AN ACCOUNT ID
--
-- People read these off a screen and retype them with spaces, hyphens and
-- lowercase. Accept all of that, then check it against the real alphabet —
-- which deliberately excludes I, L, O, U and 0/1 so there is nothing to
-- confuse.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.normalise_user_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

grant execute on function public.normalise_user_code(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. WHO OWNS THIS ACCOUNT ID?
--
-- Called before sending so the sender sees a name and can stop if it is the
-- wrong person. Rate limited, because an unlimited version of this is a
-- directory of every customer's name.
--
-- A locked account returns 'not_found' rather than 'account_locked': whether
-- somebody else is locked is none of the caller's business.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_user_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_limits  jsonb := public.transfer_limits();
  v_code    text;
  v_lookups int;
  v_target  public.profiles%rowtype;
  v_found   boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  select count(*) into v_lookups
  from public.code_lookups
  where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_lookups >= (v_limits->>'max_lookups_hour')::int then
    return jsonb_build_object('ok', false, 'reason', 'too_many_lookups');
  end if;

  v_code := public.normalise_user_code(p_code);

  -- Check the shape before touching the table, so a malformed guess costs
  -- nothing and cannot be used to time the lookup.
  if v_code !~ '^RYD[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' then
    insert into public.code_lookups (user_id, code, found) values (v_uid, v_code, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into v_target from public.profiles where user_code = v_code;
  -- Capture FOUND before anything else runs: the INSERT below resets it, and
  -- reading it afterwards would say "found" for every lookup.
  v_found := found;

  insert into public.code_lookups (user_id, code, found) values (v_uid, v_code, v_found);

  -- Keep the log bounded without needing a scheduled job. The rate limiter
  -- only ever looks an hour back; a week is plenty for working out afterwards
  -- who was probing.
  delete from public.code_lookups
  where user_id = v_uid and created_at < now() - interval '7 days';

  if not v_found then
    return jsonb_build_object('ok', false, 'reason', 'recipient_not_found');
  end if;

  if v_target.id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_transfer');
  end if;

  if v_target.locked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'recipient_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_target.user_code,
    'name', v_target.full_name
  );
end;
$$;

grant execute on function public.resolve_user_code(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. THE TRANSFER
--
-- DEADLOCK NOTE: both profile rows are locked in one statement ordered by id.
-- Locking "mine then theirs" would deadlock the moment two people sent to each
-- other at the same instant — each holding the row the other wants. Ordering
-- by id means every caller takes the same two locks in the same sequence.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_to_user(
  p_code   text,
  p_amount numeric,
  p_note   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_limits    jsonb := public.transfer_limits();
  v_code      text;
  v_target    public.profiles%rowtype;
  v_balance   numeric;
  v_sent_day  numeric;
  v_count_hr  int;
  v_ref       text;
  v_id        uuid;
  v_note      text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  -- Same gate as withdrawing. Sending balance to another account is the step a
  -- taken-over account would use to get money out through somebody else, so it
  -- sits behind the same identity check.
  if not public.has_approved_kyc(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required');
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  if p_amount < (v_limits->>'min_amount')::numeric then
    return jsonb_build_object(
      'ok', false, 'reason', 'below_minimum',
      'minimum', (v_limits->>'min_amount')::numeric
    );
  end if;

  if p_amount > (v_limits->>'max_amount')::numeric then
    return jsonb_build_object(
      'ok', false, 'reason', 'above_maximum',
      'maximum', (v_limits->>'max_amount')::numeric
    );
  end if;

  v_code := public.normalise_user_code(p_code);
  if v_code !~ '^RYD[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into v_target from public.profiles where user_code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'recipient_not_found');
  end if;

  if v_target.id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_transfer');
  end if;

  if v_target.locked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'recipient_unavailable');
  end if;

  -- Take both locks, lowest id first. Two separate statements rather than one
  -- with ORDER BY: a single SELECT ... FOR UPDATE may lock rows as the scan
  -- produces them, before the sort, so the ordering would not actually be
  -- guaranteed. least()/greatest() leave nothing to the planner.
  perform 1 from public.profiles where id = least(v_uid, v_target.id) for update;
  perform 1 from public.profiles where id = greatest(v_uid, v_target.id) for update;

  select count(*) into v_count_hr
  from public.transfers
  where sender_id = v_uid and created_at > now() - interval '1 hour';

  if v_count_hr >= (v_limits->>'max_per_hour')::int then
    return jsonb_build_object('ok', false, 'reason', 'too_many_transfers');
  end if;

  select coalesce(sum(amount), 0) into v_sent_day
  from public.transfers
  where sender_id = v_uid and created_at > now() - interval '24 hours';

  if v_sent_day + p_amount > (v_limits->>'max_per_day')::numeric then
    return jsonb_build_object(
      'ok', false, 'reason', 'daily_limit',
      'remaining_today', greatest((v_limits->>'max_per_day')::numeric - v_sent_day, 0)
    );
  end if;

  -- Read AFTER the lock: this is the figure that matters, and it already
  -- accounts for transfers sent earlier.
  v_balance := public.available_balance(v_uid);
  if p_amount > v_balance then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance);
  end if;

  v_ref  := 'RYDV-TRF-' || replace(gen_random_uuid()::text, '-', '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  insert into public.transfers (sender_id, recipient_id, amount, reference, note)
  values (v_uid, v_target.id, p_amount, v_ref, left(v_note, 140))
  returning id into v_id;

  -- One ledger row each, so the transfer shows up in both statements.
  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values
    (v_uid, 'transfer_out', p_amount, v_ref, 'success',
     jsonb_build_object('transfer_id', v_id, 'to_code', v_target.user_code)),
    (v_target.id, 'transfer_in', p_amount, v_ref, 'success',
     jsonb_build_object('transfer_id', v_id, 'from_user', v_uid));

  return jsonb_build_object(
    'ok', true,
    'transfer_id', v_id,
    'reference', v_ref,
    'recipient_name', v_target.full_name,
    'amount', p_amount,
    'balance_after', v_balance - p_amount
  );
end;
$$;

grant execute on function public.transfer_to_user(text, numeric, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS DOES AND DOES NOT STOP
--
-- Stopped: overdrawing (balance read under lock), double-spending by racing
-- two requests, sending from or to a locked account, sending to yourself,
-- fractional-naira abuse, sweeping the account-ID space, and draining an
-- account faster than the hourly and daily caps allow.
--
-- Not stopped: a user who willingly sends money to a scammer. No rule here can
-- tell that apart from a legitimate transfer, which is why the form makes the
-- sender read the recipient's name back before confirming, and why transfers
-- are final — there is no reversal function on purpose, since one would just
-- become the next attack.
-- ═══════════════════════════════════════════════════════════════════════════
