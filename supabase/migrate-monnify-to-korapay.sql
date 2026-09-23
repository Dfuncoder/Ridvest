-- ═══════════════════════════════════════════════════════════════════════════
-- WALLET + KORAPAY / MANUAL TRANSFER MIGRATION
--
-- Money now arrives in two steps instead of one:
--   1. FUND     — the user tops up their Rydvest balance, either through
--                 Korapay checkout or by sending a bank transfer to the
--                 company account and telling us they've sent it.
--   2. INVEST   — joining a pool debits that balance. No payment is in flight,
--                 so a pool that fills up mid-join fails instantly instead of
--                 leaving money stranded in a refund queue.
--
-- Safe to run on an existing database: legacy gateway-paid investments are
-- tagged funding='gateway' and are deliberately NOT subtracted from the
-- balance, since they were never funded from it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PREFLIGHT — catch up any earlier migration that was never run.
--
--    Older databases still carry pool_products.duration_months and
--    investments.paystack_reference. Both renames are guarded, so this block
--    is a no-op on an up-to-date database and safe to re-run. Running
--    migrate-months-to-weeks.sql and migrate-paystack-to-monnify.sql first is
--    no longer necessary — this file supersedes both.
-- ─────────────────────────────────────────────────────────────────────────────
do $preflight$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'pool_products'
      and column_name  = 'duration_months'
  ) then
    alter table public.pool_products rename column duration_months to duration_weeks;

    -- ⚠ Durations created while the column meant MONTHS keep their number.
    --   If you already have products priced in months, convert them by hand:
    --     update public.pool_products set duration_weeks = duration_weeks * 4;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'investments'
      and column_name  = 'paystack_reference'
  ) then
    alter table public.investments rename column paystack_reference to payment_reference;
  end if;
end
$preflight$;

alter table public.pool_products drop constraint if exists pool_products_duration_months_check;
alter table public.pool_products drop constraint if exists pool_products_duration_weeks_check;
alter table public.pool_products add constraint pool_products_duration_weeks_check
  check (duration_weeks between 1 and 520);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DEPOSITS — one row per top-up attempt.
--
--    Korapay:  pending ──(webhook/callback verified)──> credited
--    Manual:   awaiting_confirmation ──(admin clicks "Received")──> credited
--                                    └─(admin rejects)────────────> rejected
--
--    A manual row has NO amount when it is created — the user only tells us
--    that they have sent something. The figure comes from the admin reading
--    the bank account, so credited_amount is the only number we ever trust.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.deposits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id),
  amount            numeric(14,2) check (amount > 0),
  credited_amount   numeric(14,2) check (credited_amount > 0),
  method            text not null check (method in ('korapay', 'manual')),
  status            text not null default 'pending'
                    check (status in ('pending', 'awaiting_confirmation', 'credited', 'rejected')),
  reference         text not null unique,
  confirm_token     text unique,
  confirmed_by      uuid references public.profiles (id),
  admin_note        text,
  credited_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists deposits_user_idx   on public.deposits (user_id, created_at desc);
create index if not exists deposits_status_idx on public.deposits (status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INVESTMENTS — record how each one was funded.
--    'gateway' = paid directly through Paystack/Monnify before this migration.
--    'balance' = debited from the user's Rydvest balance.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.investments
  add column if not exists funding text not null default 'gateway'
  check (funding in ('gateway', 'balance'));

-- Balance-funded investments are created already paid, so pending_payment,
-- refund_pending and amount_mismatch only ever apply to legacy gateway rows.
alter table public.investments alter column payment_reference drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRANSACTIONS — the ledger gains a deposit type.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('investment', 'payout', 'withdrawal', 'refund', 'deposit'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SETTINGS — which funding method users see, and who gets notified when
--    someone declares a manual transfer.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.app_settings (key, value) values
  ('payment_method',        'manual'),
  ('deposit_notify_emails', 'info@rydvest.com'),
  ('bank_account_name',     'RYDVEST LTD'),
  ('bank_account_number',   '3005411584'),
  ('bank_name',             'GTBank')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BALANCE — now spends as well as earns.
--
--      credited deposits
--    + paid payouts
--    − investments funded from the balance
--    − withdrawals that are pending, approved or already paid
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
  - coalesce((
      select sum(amount) from public.investments
      where user_id = p_user_id and funding = 'balance' and status in ('paid', 'refund_pending')
    ), 0)
  - coalesce((
      select sum(amount) from public.withdrawals
      where user_id = p_user_id and status in ('pending', 'approved', 'paid')
    ), 0);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. KORAPAY DEPOSIT — called only from the verified webhook / callback.
--    Idempotent: replays of the same reference credit exactly once.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_paid_deposit(
  p_reference   text,
  p_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.deposits%rowtype;
begin
  select * into v_dep from public.deposits
  where reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'reference_not_found');
  end if;

  if v_dep.status = 'credited' then
    return jsonb_build_object('ok', true, 'reason', 'already_processed');
  end if;

  if v_dep.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'unexpected_status', 'status', v_dep.status);
  end if;

  -- Credit what Korapay says actually landed, never what we asked for.
  update public.deposits
  set status          = 'credited',
      credited_amount = (p_amount_kobo::numeric / 100),
      credited_at     = now()
  where id = v_dep.id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_dep.user_id, 'deposit', (p_amount_kobo::numeric / 100), p_reference, 'success',
          jsonb_build_object('method', 'korapay'));

  return jsonb_build_object('ok', true, 'amount', (p_amount_kobo::numeric / 100));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MANUAL TRANSFER — the user declares they've sent money to the company
--    account. Nothing is credited here; it only opens a request for an admin.
-- ─────────────────────────────────────────────────────────────────────────────
-- If an earlier draft of this migration was applied, drop its signatures —
-- create or replace would otherwise leave a stale overload behind.
drop function if exists public.declare_manual_deposit(numeric, text, text);
drop function if exists public.confirm_manual_deposit(uuid, uuid, numeric);

create or replace function public.declare_manual_deposit(
  p_reference text,
  p_token     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- One open declaration at a time, so the admin queue can't be flooded.
  if exists (
    select 1 from public.deposits
    where user_id = v_uid and status = 'awaiting_confirmation'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'pending_deposit_exists');
  end if;

  insert into public.deposits (user_id, method, status, reference, confirm_token)
  values (v_uid, 'manual', 'awaiting_confirmation', p_reference, p_token)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'deposit_id', v_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ADMIN CONFIRMS / REJECTS a manual transfer.
--    p_actual_amount lets the admin credit what really landed when it differs
--    from what the user typed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_manual_deposit(
  p_deposit_id    uuid,
  p_admin_id      uuid,
  p_actual_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep    public.deposits%rowtype;
  v_amount numeric;
begin
  select * into v_dep from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  end if;

  if v_dep.status = 'credited' then
    return jsonb_build_object('ok', true, 'reason', 'already_processed');
  end if;

  if v_dep.status <> 'awaiting_confirmation' then
    return jsonb_build_object('ok', false, 'reason', 'unexpected_status', 'status', v_dep.status);
  end if;

  v_amount := p_actual_amount;
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  update public.deposits
  set status          = 'credited',
      amount          = coalesce(amount, v_amount),
      credited_amount = v_amount,
      confirmed_by    = p_admin_id,
      confirm_token   = null,
      credited_at     = now()
  where id = v_dep.id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_dep.user_id, 'deposit', v_amount, v_dep.reference, 'success',
          jsonb_build_object('method', 'manual', 'confirmed_by', p_admin_id));

  return jsonb_build_object('ok', true, 'amount', v_amount, 'user_id', v_dep.user_id);
end;
$$;

create or replace function public.reject_manual_deposit(
  p_deposit_id uuid,
  p_admin_id   uuid,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dep public.deposits%rowtype;
begin
  select * into v_dep from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  end if;

  if v_dep.status <> 'awaiting_confirmation' then
    return jsonb_build_object('ok', false, 'reason', 'unexpected_status', 'status', v_dep.status);
  end if;

  update public.deposits
  set status        = 'rejected',
      confirmed_by  = p_admin_id,
      confirm_token = null,
      admin_note    = p_note
  where id = v_dep.id;

  return jsonb_build_object('ok', true, 'user_id', v_dep.user_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. JOIN A POOL FROM THE BALANCE.
--
--    Locking order is profile → pool, the same everywhere, so concurrent joins
--    queue instead of deadlocking. The profile lock is what stops two requests
--    from spending the same naira; the pool lock is what stops a pool from
--    being over-filled.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.join_pool_from_balance(
  p_pool_id uuid,
  p_amount  numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_pool      public.pools%rowtype;
  v_product   public.pool_products%rowtype;
  v_remaining numeric;
  v_balance   numeric;
  v_inv_id    uuid;
  v_ref       text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
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

  -- Private pools are for members and the creator only.
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

  -- The minimum is waived only when topping off the last slice of the pool.
  if p_amount < v_product.min_contribution and p_amount <> v_remaining then
    return jsonb_build_object('ok', false, 'reason', 'amount_too_small');
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

  -- Pool just filled — start the clock and write the weekly payout schedule.
  if v_pool.amount_raised >= v_product.target_amount then
    update public.pools
    set status     = 'active',
        started_at = now(),
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks)
    where id = v_pool.id;

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
      (now() + make_interval(weeks => gs.n))::date
    from public.investments i
    cross join generate_series(1, v_product.duration_weeks) as gs(n)
    where i.pool_id = v_pool.id and i.status = 'paid';

    return jsonb_build_object('ok', true, 'investment_id', v_inv_id, 'pool_status', 'active');
  end if;

  return jsonb_build_object('ok', true, 'investment_id', v_inv_id, 'pool_status', 'open');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RLS — users read their own deposits and nothing else. All writes go
--     through the SECURITY DEFINER functions above or the service role.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.deposits enable row level security;

drop policy if exists "deposits: owner reads" on public.deposits;
create policy "deposits: owner reads" on public.deposits
  for select using (user_id = auth.uid() or public.is_admin());

-- Crediting money is server-only: strip the default PUBLIC execute grant so a
-- logged-in user cannot call these directly, then hand execute back to the
-- service role that the webhook and admin actions run as.
revoke all on function public.apply_paid_deposit(text, bigint) from public, anon, authenticated;
revoke all on function public.confirm_manual_deposit(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.reject_manual_deposit(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.apply_paid_deposit(text, bigint) to service_role;
grant execute on function public.confirm_manual_deposit(uuid, uuid, numeric) to service_role;
grant execute on function public.reject_manual_deposit(uuid, uuid, text) to service_role;

-- These two read auth.uid(), so users call them with their own session.
grant execute on function public.declare_manual_deposit(text, text) to authenticated;
grant execute on function public.join_pool_from_balance(uuid, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. WITHDRAWALS — take the same profile lock as join_pool_from_balance().
--
--     Before this migration the balance could only be spent by withdrawing, so
--     the one-pending-request rule was enough to serialise it. Now a pool join
--     spends it too, and without a shared lock a withdrawal and a join running
--     at the same time would both read the same balance and both succeed.
--     Identical to the original apart from that lock.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.request_withdrawal(
  p_account_id uuid,
  p_amount     numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_account public.withdrawal_accounts%rowtype;
  v_profile public.profiles%rowtype;
  v_balance numeric;
  v_id      uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  -- Same lock, same order as join_pool_from_balance().
  perform 1 from public.profiles where id = v_uid for update;

  select * into v_account from public.withdrawal_accounts
  where id = p_account_id and user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'account_not_found');
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  -- The name-match rule: bank account name must equal profile name.
  if lower(regexp_replace(v_account.account_name, '\s+', ' ', 'g'))
     <> lower(regexp_replace(v_profile.full_name, '\s+', ' ', 'g')) then
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. LEGACY GATEWAY FUNCTION — kept consistent with the renamed columns.
--
--     Nothing in the wallet flow calls this any more; joining a pool goes
--     through join_pool_from_balance(). It stays so that any investment still
--     sitting in pending_payment from the old direct-to-pool checkout can
--     still be settled. If the preflight above renamed paystack_reference,
--     the previous version of this function would now point at a column that
--     no longer exists — this replaces it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_paid_investment(
  p_reference   text,
  p_amount_kobo bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv       public.investments%rowtype;
  v_pool      public.pools%rowtype;
  v_product   public.pool_products%rowtype;
  v_remaining numeric;
begin
  select * into v_inv
  from public.investments
  where payment_reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'reference_not_found');
  end if;

  if v_inv.status = 'paid' then
    return jsonb_build_object('ok', true, 'reason', 'already_processed');
  end if;

  if v_inv.status <> 'pending_payment' then
    return jsonb_build_object('ok', false, 'reason', 'unexpected_status', 'status', v_inv.status);
  end if;

  if p_amount_kobo <> (v_inv.amount * 100)::bigint then
    update public.investments set status = 'amount_mismatch' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;

  select * into v_pool from public.pools where id = v_inv.pool_id for update;
  select * into v_product from public.pool_products where id = v_pool.product_id;

  v_remaining := v_product.target_amount - v_pool.amount_raised;

  if v_pool.status <> 'open' or v_inv.amount > v_remaining then
    update public.investments set status = 'refund_pending' where id = v_inv.id;
    insert into public.transactions (user_id, type, amount, reference, status, metadata)
    values (v_inv.user_id, 'refund', v_inv.amount, p_reference, 'pending',
            jsonb_build_object('pool_id', v_pool.id, 'reason', 'pool_full'));
    return jsonb_build_object('ok', false, 'reason', 'pool_full_refund_pending');
  end if;

  update public.investments
  set status = 'paid', paid_at = now()
  where id = v_inv.id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_inv.user_id, 'investment', v_inv.amount, p_reference, 'success',
          jsonb_build_object('pool_id', v_pool.id));

  update public.pools
  set amount_raised = amount_raised + v_inv.amount
  where id = v_pool.id
  returning * into v_pool;

  if v_pool.amount_raised >= v_product.target_amount then
    update public.pools
    set status     = 'active',
        started_at = now(),
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks)
    where id = v_pool.id;

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
      (now() + make_interval(weeks => gs.n))::date
    from public.investments i
    cross join generate_series(1, v_product.duration_weeks) as gs(n)
    where i.pool_id = v_pool.id and i.status = 'paid';
  end if;

  return jsonb_build_object('ok', true, 'pool_status', v_pool.status);
end;
$$;
