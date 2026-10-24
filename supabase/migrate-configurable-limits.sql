-- ═══════════════════════════════════════════════════════════════════════════
-- LIMITS, FEES AND SWITCHES THE ADMIN CAN CHANGE
--
-- Transfer caps and the transfer fee were constants compiled into these
-- functions, so changing one meant editing SQL in the Supabase console — the
-- kind of job that gets done at 2am by whoever is awake. They now live in
-- app_settings and are read on every call, so an admin changes them from
-- /admin/settings and the next transaction already obeys.
--
-- Three things are added at the same time:
--   • a withdrawal fee, defaulting to ZERO, so nothing changes for anyone
--     until somebody deliberately sets it;
--   • a switch to stop withdrawals;
--   • a switch to stop internal transfers.
--
-- ── WHY THE ENFORCEMENT STAYS HERE ───────────────────────────────────────
-- The settings are data, but the rules are still SQL. Every check below runs
-- inside the same transaction that moves the money, so turning transfers off
-- stops them for anybody who calls the function — a crafted request that
-- never loads a page included. The admin screen is a way to change a number;
-- it is not where the rule lives.
--
-- ── WHY A BAD VALUE CANNOT OPEN A HOLE ───────────────────────────────────
-- setting_num() only accepts a plain number and falls back to the safe
-- default for anything else. A typo in the admin form cannot delete a cap,
-- make a fee negative, or throw an exception inside a money function — the
-- worst it can do is leave the previous default in force.
--
-- ⚠ RUN AFTER migrate-pin-and-transfer-fee.sql, whose versions of
--   available_balance(), request_withdrawal() and transfer_to_user() this
--   file replaces.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE SETTINGS THEMSELVES
--
-- Seeded with exactly what the constants used to be, so running this file
-- changes nobody's experience until an admin edits something. The withdrawal
-- fee is the one new figure, and it is zero.
--
-- app_settings is world-readable (the landing page reads the headline rate
-- from it) and nothing here is secret: a user is told these limits by the
-- form anyway. Writes have no policy at all, so they only happen through the
-- service role, from an action that checks for an admin first.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.app_settings (key, value) values
  ('transfer_min_amount',       '100'),
  ('transfer_max_amount',       '2000000'),
  ('transfer_max_per_day',      '5000000'),
  ('transfer_max_per_hour',     '10'),
  ('transfer_max_lookups_hour', '30'),
  ('transfer_fee',              '50'),
  ('withdrawal_fee',            '0'),
  ('transfers_enabled',         '1'),
  ('withdrawals_enabled',       '1')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. READING THEM SAFELY
--
-- The regex is the whole point: a value that is not a plain non-negative
-- number is ignored entirely rather than cast — `'2,000,000'::numeric` would
-- raise inside whatever money function happened to be running, and a NULL
-- would silently compare false against every limit, which is worse than
-- raising.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.setting_num(p_key text, p_fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select trim(value)::numeric
      from public.app_settings
      where key = p_key
        and trim(value) ~ '^[0-9]+(\.[0-9]+)?$'
    ),
    p_fallback
  );
$$;

comment on function public.setting_num(text, numeric) is
  'A numeric app_setting, or the fallback when it is missing or not a plain '
  'non-negative number. Never raises; a bad value can only leave the default '
  'in force.';

create or replace function public.setting_flag(p_key text, p_fallback boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when lower(trim(value)) in ('1', 'true', 'on', 'yes')  then true
        when lower(trim(value)) in ('0', 'false', 'off', 'no') then false
        else null
      end
      from public.app_settings
      where key = p_key
    ),
    p_fallback
  );
$$;

comment on function public.setting_flag(text, boolean) is
  'An on/off app_setting. Anything unrecognised falls back, so a mangled '
  'value cannot accidentally disable a service.';

-- Readable by signed-in users: the transfer form tells people the limits
-- before they type, and the withdrawal form shows the fee.
grant execute on function public.setting_num(text, numeric) to authenticated;
grant execute on function public.setting_flag(text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. THE LIMITS, NOW READ RATHER THAN COMPILED
--
-- No longer `immutable` — it reads a table, so it is `stable`. Declaring it
-- immutable while it reads rows would let the planner cache a value across
-- statements, and a limit that changes but keeps being enforced at its old
-- number is the worst of both.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_limits()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'min_amount',       public.setting_num('transfer_min_amount',       100),
    'max_amount',       public.setting_num('transfer_max_amount',       2000000),
    'max_per_day',      public.setting_num('transfer_max_per_day',      5000000),
    'max_per_hour',     public.setting_num('transfer_max_per_hour',     10),
    'max_lookups_hour', public.setting_num('transfer_max_lookups_hour', 30)
  );
$$;

grant execute on function public.transfer_limits() to authenticated;

create or replace function public.transfer_fee()
returns numeric
language sql
stable
security definer
set search_path = public
as $$ select public.setting_num('transfer_fee', 50); $$;

comment on function public.transfer_fee() is
  'Flat charge on an internal transfer, paid by the sender on top of the '
  'amount. Set in /admin/settings; lib/economics.ts holds the same number '
  'only as a fallback for display.';

grant execute on function public.transfer_fee() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THE WITHDRAWAL FEE — new, and zero until somebody says otherwise
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.withdrawal_fee()
returns numeric
language sql
stable
security definer
set search_path = public
as $$ select public.setting_num('withdrawal_fee', 0); $$;

comment on function public.withdrawal_fee() is
  'Flat charge on a withdrawal, taken from the balance on top of the amount '
  'requested. Default 0 — the user receives exactly what they asked for.';

grant execute on function public.withdrawal_fee() to authenticated;

alter table public.withdrawals
  add column if not exists fee numeric(14,2) not null default 0;

comment on column public.withdrawals.fee is
  'What was charged on top of amount, at the rate in force when the request '
  'was made. Stored per row so a later change to the fee never rewrites '
  'history, and so income is auditable without a second ledger.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. THE SWITCHES
--
-- Deliberately two, not one. Stopping withdrawals while a bank is down is an
-- ordinary operational hour; stopping internal transfers is what you do when
-- you think money is being moved between accounts to launder it. They are
-- different decisions with different costs, so they are different switches.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.withdrawals_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.setting_flag('withdrawals_enabled', true); $$;

create or replace function public.transfers_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.setting_flag('transfers_enabled', true); $$;

grant execute on function public.withdrawals_enabled() to authenticated;
grant execute on function public.transfers_enabled() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BALANCE — now also out of pocket for the withdrawal fee
--
-- Reproduced in full from migrate-pin-and-transfer-fee.sql with `+ fee` on
-- the withdrawals line. Without it, a fee would be charged on the row and the
-- same money would still be spendable everywhere else.
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
      select sum(amount + fee) from public.transfers
      where sender_id = p_user_id
    ), 0)
  - coalesce((
      select sum(amount) from public.investments
      where user_id = p_user_id and funding = 'balance' and status in ('paid', 'refund_pending')
    ), 0)
  - coalesce((
      select sum(amount + fee) from public.withdrawals
      where user_id = p_user_id and status in ('pending', 'approved', 'paid')
    ), 0);
$$;

grant execute on function public.available_balance(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. WITHDRAWING — switch, then fee
--
-- The switch is checked before anything else that costs a round trip, but
-- AFTER the authentication check, so a signed-out caller still gets the
-- honest reason rather than being told the service is paused.
--
-- Everything else is the version from migrate-pin-and-transfer-fee.sql,
-- unchanged: lock check, KYC gate, PIN, row lock, name match, one pending
-- request at a time.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.request_withdrawal(
  p_account_id uuid,
  p_amount     numeric,
  p_pin        text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_account public.withdrawal_accounts%rowtype;
  v_profile public.profiles%rowtype;
  v_balance numeric;
  v_fee     numeric := public.withdrawal_fee();
  v_pin     jsonb;
  v_id      uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.withdrawals_enabled() then
    return jsonb_build_object('ok', false, 'reason', 'withdrawals_paused');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  if not public.has_approved_kyc(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required');
  end if;

  v_pin := public.verify_transaction_pin(v_uid, p_pin);
  if not (v_pin->>'ok')::boolean then
    return v_pin;
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  select * into v_account from public.withdrawal_accounts
  where id = p_account_id and user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'account_not_found');
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  if not public.names_match(v_account.account_name, v_profile.full_name) then
    return jsonb_build_object('ok', false, 'reason', 'name_mismatch');
  end if;

  if exists (select 1 from public.withdrawals where user_id = v_uid and status = 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'pending_request_exists');
  end if;

  -- The balance has to cover the amount AND the fee. Checked under the row
  -- lock taken above, so two requests in flight cannot both pass.
  v_balance := public.available_balance(v_uid);
  if p_amount + v_fee > v_balance then
    return jsonb_build_object(
      'ok', false, 'reason', 'insufficient_balance',
      'balance', v_balance, 'needed', p_amount + v_fee
    );
  end if;

  insert into public.withdrawals (user_id, account_id, amount, fee)
  values (v_uid, p_account_id, p_amount, v_fee)
  returning id into v_id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_uid, 'withdrawal', p_amount, v_id::text, 'pending',
          jsonb_build_object('account_id', p_account_id, 'fee', v_fee));

  return jsonb_build_object('ok', true, 'withdrawal_id', v_id, 'fee', v_fee);
end;
$$;

grant execute on function public.request_withdrawal(uuid, numeric, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SENDING TO ANOTHER ACCOUNT — the switch, in the same place
--
-- Only the switch is added here. The rest of the function is reproduced from
-- migrate-pin-and-transfer-fee.sql exactly, because `create or replace`
-- rewrites the whole body and a partial copy would quietly drop a rule.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_to_user(
  p_code   text,
  p_amount numeric,
  p_pin    text,
  p_note   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_limits    jsonb := public.transfer_limits();
  v_fee       numeric := public.transfer_fee();
  v_code      text;
  v_target    public.profiles%rowtype;
  v_balance   numeric;
  v_sent_day  numeric;
  v_count_hr  int;
  v_pin       jsonb;
  v_ref       text;
  v_id        uuid;
  v_note      text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.transfers_enabled() then
    return jsonb_build_object('ok', false, 'reason', 'transfers_paused');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

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
  if v_code is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select * into v_target from public.profiles where user_code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'recipient_not_found');
  end if;

  if v_target.id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self_transfer');
  end if;

  if public.is_locked(v_target.id) or not public.has_approved_kyc(v_target.id) then
    return jsonb_build_object('ok', false, 'reason', 'recipient_unavailable');
  end if;

  v_pin := public.verify_transaction_pin(v_uid, p_pin);
  if not (v_pin->>'ok')::boolean then
    return v_pin;
  end if;

  -- Both rows locked in a fixed order — least() then greatest(), as two
  -- separate statements — so two people sending to each other at the same
  -- moment cannot deadlock.
  perform 1 from public.profiles
   where id = least(v_uid, v_target.id) for update;
  perform 1 from public.profiles
   where id = greatest(v_uid, v_target.id) for update;

  select count(*) into v_count_hr
  from public.transfers
  where sender_id = v_uid and created_at >= now() - interval '1 hour';

  if v_count_hr >= (v_limits->>'max_per_hour')::int then
    return jsonb_build_object('ok', false, 'reason', 'too_many_transfers');
  end if;

  select coalesce(sum(amount), 0) into v_sent_day
  from public.transfers
  where sender_id = v_uid and created_at >= now() - interval '1 day';

  if v_sent_day + p_amount > (v_limits->>'max_per_day')::numeric then
    return jsonb_build_object(
      'ok', false, 'reason', 'daily_limit',
      'sent_today', v_sent_day, 'limit', (v_limits->>'max_per_day')::numeric
    );
  end if;

  -- The sender must cover the amount AND the fee.
  v_balance := public.available_balance(v_uid);
  if p_amount + v_fee > v_balance then
    return jsonb_build_object(
      'ok', false, 'reason', 'insufficient_balance',
      'balance', v_balance, 'needed', p_amount + v_fee
    );
  end if;

  v_ref := 'RYDV-TRF-' || replace(gen_random_uuid()::text, '-', '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  insert into public.transfers (sender_id, recipient_id, amount, fee, reference, note)
  values (v_uid, v_target.id, p_amount, v_fee, v_ref, left(v_note, 140))
  returning id into v_id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values
    (v_uid, 'transfer_out', p_amount, v_ref, 'success',
     jsonb_build_object('to', v_target.user_code, 'fee', v_fee, 'transfer_id', v_id)),
    (v_target.id, 'transfer_in', p_amount, v_ref || '-IN', 'success',
     jsonb_build_object('from', (select user_code from public.profiles where id = v_uid),
                        'transfer_id', v_id));

  return jsonb_build_object(
    'ok', true, 'transfer_id', v_id, 'reference', v_ref,
    'amount', p_amount, 'fee', v_fee,
    'recipient', v_target.full_name, 'recipient_code', v_target.user_code
  );
end;
$$;

grant execute on function public.transfer_to_user(text, numeric, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. FEE INCOME, BOTH KINDS
--
-- Withdrawal fees reported the same way transfer fees already are, so the
-- admin dashboard can show one number per source rather than a total nobody
-- can break down.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.withdrawal_fee_income()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total',      coalesce(sum(fee), 0),
    'count',      count(*) filter (where fee > 0),
    'today',      coalesce(sum(fee) filter (where requested_at >= date_trunc('day', now())), 0),
    'this_month', coalesce(sum(fee) filter (where requested_at >= date_trunc('month', now())), 0),
    'last_30d',   coalesce(sum(fee) filter (where requested_at >= now() - interval '30 days'), 0),
    'volume',     coalesce(sum(amount), 0)
  )
  from public.withdrawals
  where status in ('approved', 'paid');
$$;

revoke all on function public.withdrawal_fee_income() from public, anon, authenticated;
grant execute on function public.withdrawal_fee_income() to service_role;
