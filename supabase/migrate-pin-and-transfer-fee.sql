-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSACTION PIN, AND A FEE ON INTERNAL TRANSFERS
--
-- Two changes that both belong to the same three functions, so they are made
-- together rather than reproducing those bodies twice.
--
-- ── 1. A 4-DIGIT PIN ON EVERY OUTGOING MOVEMENT ──────────────────────────
--   Withdrawing, joining a pool and sending to another account now all take a
--   PIN and verify it INSIDE the function, under the same transaction that
--   moves the money. Not in the server action, not in the form: a request that
--   skips the UI entirely still cannot move a naira without the PIN.
--
--   Depositing is deliberately exempt. A PIN protects money leaving; asking
--   for one to put money in is friction with nothing behind it.
--
--   THE PIN IS HASHED, NOT ENCRYPTED. This is the opposite choice to the NIN
--   (lib/crypto.ts), and for a good reason: a NIN has to be read back and
--   shown to an admin, so it must be reversible. A PIN only ever has to answer
--   "is this the same one?", so the right thing is bcrypt — nobody, including
--   us, can read it, and a database leak gives an attacker nothing to use.
--
--   FOUR DIGITS IS 10,000 GUESSES, which is nothing without a lockout. Five
--   wrong attempts locks the PIN for fifteen minutes, and the counter lives
--   with the attempt itself so it cannot be sidestepped by retrying fast.
--
-- ── 2. ₦50 PER INTERNAL TRANSFER ─────────────────────────────────────────
--   The sender pays amount + fee; the recipient receives the amount. The fee
--   is recorded on the transfer row, which makes it both auditable and
--   reportable as income without a second ledger to reconcile.
--
--   available_balance() has to subtract the fee too, or the money would be
--   charged and then still be spendable.
--
-- ⚠ RUN ORDER: after migrate-internal-transfers.sql, migrate-kyc.sql and
--   migrate-user-lock.sql, whose guards these functions carry forward.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- bcrypt lives here. Supabase ships it; this is a no-op if already enabled.
create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE PIN ITSELF
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists pin_hash         text,
  add column if not exists pin_set_at       timestamptz,
  add column if not exists pin_attempts     integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

comment on column public.profiles.pin_hash is
  'bcrypt hash of the 4-digit transaction PIN. Never readable, never sent to the client.';

-- The hash must never reach the browser, even for its owner. profiles is
-- granted column by column, so this simply stays off the list.
revoke select (pin_hash) on public.profiles from authenticated;

/** How many wrong tries before the PIN locks, and for how long. */
create or replace function public.pin_max_attempts()
returns integer language sql immutable as $$ select 5; $$;

create or replace function public.pin_lock_minutes()
returns integer language sql immutable as $$ select 15; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SETTING AND CHANGING IT
--
-- Changing an existing PIN requires the current one. Somebody who walks up to
-- an unlocked phone should not be able to quietly replace it with their own.
-- A forgotten PIN is reset through the password-reauthenticated server action,
-- which calls this with p_force.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_transaction_pin(
  p_new_pin     text,
  p_current_pin text default null,
  p_force       boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'reason', 'pin_invalid');
  end if;

  -- A PIN everybody tries first is barely a PIN. Rejected here as well as in
  -- the form, because the form is not the gate.
  if p_new_pin in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
                   '1234','4321','1212','2121','0123','9876','1004','2580')
  then
    return jsonb_build_object('ok', false, 'reason', 'pin_too_simple');
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  if v_profile.pin_hash is not null and not p_force then
    if p_current_pin is null or p_current_pin !~ '^[0-9]{4}$'
       or crypt(p_current_pin, v_profile.pin_hash) <> v_profile.pin_hash then
      return jsonb_build_object('ok', false, 'reason', 'current_pin_wrong');
    end if;
  end if;

  update public.profiles
  set pin_hash         = crypt(p_new_pin, gen_salt('bf', 10)),
      pin_set_at       = now(),
      pin_attempts     = 0,
      pin_locked_until = null
  where id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_transaction_pin(text, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CHECKING IT
--
-- Deliberately takes NO row lock. The callers below lock profile rows in a
-- fixed order to stay deadlock-free, and a lock taken here first would break
-- that ordering — two people sending to each other would deadlock. The attempt
-- counter is incremented inside a single UPDATE, which is atomic on its own.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.verify_transaction_pin(p_user_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash     text;
  v_locked   timestamptz;
  v_attempts integer;
  v_max      integer := public.pin_max_attempts();
begin
  select pin_hash, pin_locked_until into v_hash, v_locked
  from public.profiles where id = p_user_id;

  if v_hash is null then
    return jsonb_build_object('ok', false, 'reason', 'pin_not_set');
  end if;

  if v_locked is not null and v_locked > now() then
    return jsonb_build_object('ok', false, 'reason', 'pin_locked', 'until', v_locked);
  end if;

  -- A malformed PIN still burns an attempt: otherwise the lockout could be
  -- avoided by probing with values the format check rejects for free.
  if p_pin is not null and p_pin ~ '^[0-9]{4}$' and crypt(p_pin, v_hash) = v_hash then
    update public.profiles
    set pin_attempts = 0, pin_locked_until = null
    where id = p_user_id;
    return jsonb_build_object('ok', true);
  end if;

  update public.profiles
  set pin_attempts     = pin_attempts + 1,
      pin_locked_until = case
        when pin_attempts + 1 >= v_max
          then now() + make_interval(mins => public.pin_lock_minutes())
        else pin_locked_until
      end
  where id = p_user_id
  returning pin_attempts, pin_locked_until into v_attempts, v_locked;

  if v_locked is not null and v_locked > now() then
    return jsonb_build_object('ok', false, 'reason', 'pin_locked', 'until', v_locked);
  end if;

  return jsonb_build_object(
    'ok', false, 'reason', 'pin_wrong',
    'attempts_left', greatest(v_max - v_attempts, 0)
  );
end;
$$;

grant execute on function public.verify_transaction_pin(uuid, text) to authenticated;

/** Does this user have a PIN yet? Used to send them to set one up. */
create or replace function public.has_transaction_pin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and pin_hash is not null);
$$;

grant execute on function public.has_transaction_pin() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. THE TRANSFER FEE
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_fee()
returns numeric
language sql
immutable
as $$ select 50::numeric; $$;

comment on function public.transfer_fee() is
  'Flat charge on an internal transfer, paid by the sender on top of the '
  'amount. Mirrored by TRANSFER_FEE in lib/economics.ts.';

grant execute on function public.transfer_fee() to authenticated;

alter table public.transfers
  add column if not exists fee numeric(14,2) not null default 0;

comment on column public.transfers.fee is
  'What the sender was charged on top of amount. Recorded per row so platform '
  'income is auditable without a second ledger to reconcile.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BALANCE — now also out of pocket for the fee.
--
-- Reproduced in full from migrate-internal-transfers.sql with `+ fee` on the
-- sender's side. Without it the fee would be charged and the money still be
-- spendable.
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
      select sum(amount) from public.withdrawals
      where user_id = p_user_id and status in ('pending', 'approved', 'paid')
    ), 0);
$$;

grant execute on function public.available_balance(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. WITHDRAWING — now with a PIN.
--
-- The old 2-argument version is dropped, not left beside this one: an
-- overload that still works without a PIN would be a way around the whole
-- feature.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.request_withdrawal(uuid, numeric);

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
  v_pin     jsonb;
  v_id      uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
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

  v_balance := public.available_balance(v_uid);
  if p_amount > v_balance then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance);
  end if;

  insert into public.withdrawals (user_id, account_id, amount)
  values (v_uid, p_account_id, p_amount)
  returning id into v_id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_uid, 'withdrawal', p_amount, v_id::text, 'pending',
          jsonb_build_object('account_id', p_account_id));

  return jsonb_build_object('ok', true, 'withdrawal_id', v_id);
end;
$$;

grant execute on function public.request_withdrawal(uuid, numeric, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. JOINING A POOL — now with a PIN.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.join_pool_from_balance(uuid, numeric);

create or replace function public.join_pool_from_balance(
  p_pool_id uuid,
  p_amount  numeric,
  p_pin     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_pool      public.pools%rowtype;
  v_product   public.pool_products%rowtype;
  v_remaining numeric;
  v_minimum   numeric;
  v_balance   numeric;
  v_pin       jsonb;
  v_inv_id    uuid;
  v_ref       text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  v_pin := public.verify_transaction_pin(v_uid, p_pin);
  if not (v_pin->>'ok')::boolean then
    return v_pin;
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  perform 1 from public.profiles where id = v_uid for update;

  select * into v_pool from public.pools where id = p_pool_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'pool_not_found');
  end if;

  select * into v_product from public.pool_products where id = v_pool.product_id;
  if not found or not v_product.active then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive');
  end if;

  if v_pool.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'pool_not_open');
  end if;

  if v_pool.is_private
     and v_pool.created_by is distinct from v_uid
     and not exists (
       select 1 from public.investments
       where pool_id = v_pool.id and user_id = v_uid
     ) then
    return jsonb_build_object('ok', false, 'reason', 'pool_not_found');
  end if;

  v_remaining := v_product.target_amount - v_pool.amount_raised;
  if p_amount > v_remaining then
    return jsonb_build_object('ok', false, 'reason', 'amount_too_large', 'remaining', v_remaining);
  end if;

  v_minimum := case
    when v_pool.is_private
      then greatest(v_product.min_contribution, public.private_pool_minimum())
    else v_product.min_contribution
  end;

  if p_amount < v_minimum and p_amount <> v_remaining then
    return jsonb_build_object(
      'ok', false, 'reason', 'amount_too_small', 'minimum', v_minimum
    );
  end if;

  v_balance := public.available_balance(v_uid);
  if p_amount > v_balance then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance);
  end if;

  v_ref := 'RYDV-BAL-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.investments (pool_id, user_id, amount, status, funding, payment_reference, paid_at)
  values (p_pool_id, v_uid, p_amount, 'paid', 'balance', v_ref, now())
  returning id into v_inv_id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_uid, 'investment', p_amount, v_ref, 'success',
          jsonb_build_object('pool_id', p_pool_id, 'funding', 'balance'));

  update public.pools
  set amount_raised = amount_raised + p_amount
  where id = p_pool_id
  returning * into v_pool;

  if v_pool.amount_raised >= v_product.target_amount then
    update public.pools
    set status     = 'active',
        started_at = now(),
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks + 1)
    where id = v_pool.id;

    -- Payouts run weeks 2..N+1: the first week after funding is for deploying
    -- the vehicle, so nothing is due then.
    insert into public.payouts (investment_id, user_id, pool_id, amount, due_date)
    select
      i.id,
      i.user_id,
      i.pool_id,
      case
        when gs.n = v_product.duration_weeks then
          round(i.amount * (1 + v_product.roi_percent / 100.0), 2)
          - trunc(round(i.amount * (1 + v_product.roi_percent / 100.0), 2)
                  / v_product.duration_weeks, 2) * (v_product.duration_weeks - 1)
        else
          trunc(round(i.amount * (1 + v_product.roi_percent / 100.0), 2)
                / v_product.duration_weeks, 2)
      end,
      (now() + make_interval(weeks => gs.n + 1))::date
    from public.investments i
    cross join generate_series(1, v_product.duration_weeks) as gs(n)
    where i.pool_id = v_pool.id and i.status = 'paid';

    return jsonb_build_object('ok', true, 'investment_id', v_inv_id, 'pool_status', 'active');
  end if;

  return jsonb_build_object('ok', true, 'investment_id', v_inv_id, 'pool_status', 'open');
end;
$$;

grant execute on function public.join_pool_from_balance(uuid, numeric, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SENDING — now with a PIN and a fee.
--
-- The PIN is verified AFTER both profile rows are locked, not before. Locking
-- is what keeps two people sending to each other at the same instant from
-- deadlocking, and it only works if every caller takes those locks first.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.transfer_to_user(text, numeric, text);

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

  -- Locks first, lowest id first, THEN the PIN — see the note above.
  perform 1 from public.profiles where id = least(v_uid, v_target.id) for update;
  perform 1 from public.profiles where id = greatest(v_uid, v_target.id) for update;

  v_pin := public.verify_transaction_pin(v_uid, p_pin);
  if not (v_pin->>'ok')::boolean then
    return v_pin;
  end if;

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

  -- The sender must cover the amount AND the fee.
  v_balance := public.available_balance(v_uid);
  if p_amount + v_fee > v_balance then
    return jsonb_build_object(
      'ok', false, 'reason', 'insufficient_balance',
      'balance', v_balance, 'needed', p_amount + v_fee
    );
  end if;

  v_ref  := 'RYDV-TRF-' || replace(gen_random_uuid()::text, '-', '');
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  insert into public.transfers (sender_id, recipient_id, amount, fee, reference, note)
  values (v_uid, v_target.id, p_amount, v_fee, v_ref, left(v_note, 140))
  returning id into v_id;

  -- The sender's ledger line is amount + fee, because that is what left their
  -- balance. The fee is kept in metadata so a statement can break it out.
  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values
    (v_uid, 'transfer_out', p_amount + v_fee, v_ref, 'success',
     jsonb_build_object('transfer_id', v_id, 'to_code', v_target.user_code,
                        'amount', p_amount, 'fee', v_fee)),
    (v_target.id, 'transfer_in', p_amount, v_ref, 'success',
     jsonb_build_object('transfer_id', v_id, 'from_user', v_uid));

  return jsonb_build_object(
    'ok', true,
    'transfer_id', v_id,
    'reference', v_ref,
    'recipient_name', v_target.full_name,
    'amount', p_amount,
    'fee', v_fee,
    'balance_after', v_balance - p_amount - v_fee
  );
end;
$$;

grant execute on function public.transfer_to_user(text, numeric, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. WHAT THE FEES ADD UP TO — for the admin dashboard.
--
-- Returned as one row so the overview does not have to pull every transfer
-- just to total a column.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.transfer_fee_income()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total',      coalesce(sum(fee), 0),
    'count',      count(*),
    'today',      coalesce(sum(fee) filter (where created_at >= date_trunc('day', now())), 0),
    'this_month', coalesce(sum(fee) filter (where created_at >= date_trunc('month', now())), 0),
    'last_30d',   coalesce(sum(fee) filter (where created_at >= now() - interval '30 days'), 0),
    'volume',     coalesce(sum(amount), 0)
  )
  from public.transfers;
$$;

grant execute on function public.transfer_fee_income() to service_role;
