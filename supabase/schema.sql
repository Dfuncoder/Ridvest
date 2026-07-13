-- ════════════════════════════════════════════════════════════════════════════
-- RYDVEST — Complete database schema for Supabase (PostgreSQL)
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   It is safe to run on a brand-new project. It is idempotent-ish (uses
--   IF NOT EXISTS / CREATE OR REPLACE where possible), but it is designed to
--   be run ONCE on a fresh project.
--
-- SECURITY MODEL (read this before changing anything):
--   • Row Level Security (RLS) is ENABLED on every table. By default nobody
--     can read or write anything.
--   • Users (logged in through the publishable key + their session JWT) get
--     narrow SELECT access to THEIR OWN rows only, via the policies below.
--   • ALL financial writes (investments, pools, payouts, withdrawals,
--     transactions) are performed by the server using the SECRET key, which
--     bypasses RLS — after the server code has validated the request.
--     Users have NO direct write access to financial tables.
--   • Money-critical state transitions (confirming a payment, filling a pool,
--     requesting a withdrawal) happen inside SQL functions in this file so
--     they are ATOMIC — two simultaneous payments can never overfill a pool
--     or double-credit an investment.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto; -- gen_random_uuid()


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES — one row per registered user, mirrors auth.users
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null,
  email              text not null unique,
  phone              text not null,
  dob                date not null,                -- date of birth (must be 18+, enforced at signup)
  address            text not null,
  state_of_residence text not null,
  role               text not null default 'user' check (role in ('user', 'admin')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is
  'User profile data captured at signup. role=admin unlocks the admin dashboard. '
  'To promote your first admin run: '
  'UPDATE public.profiles SET role = ''admin'' WHERE email = ''you@example.com'';';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WITHDRAWAL ACCOUNTS — bank details a user can withdraw to.
--    RULE: the account holder name MUST match the profile full name, otherwise
--    withdrawal requests referencing it are rejected (enforced in
--    request_withdrawal() below AND in the server action).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.withdrawal_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  bank_name      text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'), -- NUBAN = 10 digits
  account_name   text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, account_number)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POOL PRODUCTS — the investment "options" the admin creates.
--    e.g. name: "Keke Napep", target 2,500,000, 52 weeks, 50% ROI.
--    Users (or the admin) then open POOLS based on a product.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pool_products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,                    -- e.g. "Keke Napep"
  description      text,
  target_amount    numeric(14,2) not null check (target_amount > 0),      -- ₦ price to fill one pool
  min_contribution numeric(14,2) not null check (min_contribution > 0),   -- ₦ smallest slice a user may buy
  duration_weeks  integer not null check (duration_weeks between 1 and 520),
  roi_percent      numeric(6,2) not null check (roi_percent >= 0),        -- e.g. 50 = 50% total return
  active           boolean not null default true,    -- inactive products can no longer be invested in
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (min_contribution <= target_amount)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. POOLS — a live instance of a product being filled with money.
--    A pool only STARTS (status → active) once amount_raised reaches the
--    product target. That transition happens atomically in
--    apply_paid_investment() below.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pools (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.pool_products (id),
  name          text not null,                       -- display name, e.g. "Keke Pool #4" or "Jude & friends"
  created_by    uuid references public.profiles (id),-- null = created by admin/system
  status        text not null default 'open'
                check (status in ('open', 'active', 'completed', 'cancelled')),
  amount_raised numeric(14,2) not null default 0 check (amount_raised >= 0),
  is_private    boolean not null default false,      -- private pools are joined via invite code only
  invite_code   text unique,                         -- 8-char code, only set for private pools
  started_at    timestamptz,                         -- set when the pool fills
  ends_at       timestamptz,                         -- started_at + product duration
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pools_status_idx  on public.pools (status);
create index if not exists pools_product_idx on public.pools (product_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVESTMENTS — a user's paid (or pending) contribution to a pool.
--    Lifecycle: pending_payment → paid            (normal, via Paystack webhook)
--               pending_payment → refund_pending  (pool filled first / amount mismatch)
--               refund_pending  → refunded        (admin refunds via Paystack, marks here)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.investments (
  id                 uuid primary key default gen_random_uuid(),
  pool_id            uuid not null references public.pools (id),
  user_id            uuid not null references public.profiles (id),
  amount             numeric(14,2) not null check (amount > 0),
  status             text not null default 'pending_payment'
                     check (status in ('pending_payment', 'paid', 'refund_pending', 'refunded', 'amount_mismatch')),
  paystack_reference text not null unique,           -- our reference, sent to Paystack; idempotency key
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists investments_pool_idx on public.investments (pool_id);
create index if not exists investments_user_idx on public.investments (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PAYOUTS — the weekly return schedule, generated the moment a pool fills.
--    total return  = amount × (1 + roi/100)
--    weekly        = total / duration_weeks (last week absorbs rounding)
--    status: scheduled → paid (admin marks paid; this credits the user's
--    withdrawable balance).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id            uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments (id),
  user_id       uuid not null references public.profiles (id),
  pool_id       uuid not null references public.pools (id),
  amount        numeric(14,2) not null check (amount >= 0),
  due_date      date not null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'paid')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists payouts_user_idx on public.payouts (user_id, due_date);
create index if not exists payouts_due_idx  on public.payouts (status, due_date);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. WITHDRAWALS — user requests to move earned money to their bank account.
--    pending → approved → paid   (admin pays the bank transfer, marks paid)
--    pending → rejected          (admin rejects with a note)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.withdrawals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id),
  account_id   uuid not null references public.withdrawal_accounts (id),
  amount       numeric(14,2) not null check (amount > 0),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_note   text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists withdrawals_user_idx   on public.withdrawals (user_id);
create index if not exists withdrawals_status_idx on public.withdrawals (status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRANSACTIONS — append-only money ledger. One row per money event.
--    This is what the admin uses to make sure everything tallies.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id),
  type       text not null check (type in ('investment', 'payout', 'withdrawal', 'refund')),
  amount     numeric(14,2) not null,
  reference  text,
  status     text not null default 'success' check (status in ('success', 'pending', 'failed')),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUDIT LOG — every admin action is recorded here (who, what, when).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id),
  action     text not null,                          -- e.g. 'payout.mark_paid'
  target     text,                                   -- e.g. a payout/withdrawal/user id
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. APP SETTINGS — simple key/value store for tweakable numbers
--     (e.g. the headline interest rate shown on the landing page).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('interest_rate_percent', '50')
on conflict (key) do nothing;


-- ═════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════════

-- Is the currently logged-in user an admin?
-- SECURITY DEFINER so it can read profiles regardless of RLS (avoids recursive
-- policy evaluation). Used inside RLS policies below.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Is the currently logged-in user a member (paid or pending investor) or the
-- creator of the given pool? Used by the pools SELECT policy so private pools
-- stay hidden from strangers.
create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.investments
    where pool_id = p_pool_id and user_id = auth.uid()
  )
  or exists (
    select 1 from public.pools
    where id = p_pool_id and created_by = auth.uid()
  );
$$;

-- A user's withdrawable balance:
--   everything credited by paid payouts, minus every withdrawal that is
--   pending, approved or already paid (rejected ones give the money back).
create or replace function public.available_balance(p_user_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select sum(amount) from public.payouts
    where user_id = p_user_id and status = 'paid'
  ), 0)
  -
  coalesce((
    select sum(amount) from public.withdrawals
    where user_id = p_user_id and status in ('pending', 'approved', 'paid')
  ), 0);
$$;

-- Convenience RPC for the logged-in user to read their own balance.
create or replace function public.my_available_balance()
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select public.available_balance(auth.uid());
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═════════════════════════════════════════════════════════════════════════════

-- Keep updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists withdrawal_accounts_updated_at on public.withdrawal_accounts;
create trigger withdrawal_accounts_updated_at before update on public.withdrawal_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists pool_products_updated_at on public.pool_products;
create trigger pool_products_updated_at before update on public.pool_products
  for each row execute function public.set_updated_at();

drop trigger if exists pools_updated_at on public.pools;
create trigger pools_updated_at before update on public.pools
  for each row execute function public.set_updated_at();

-- When a new user confirms signup in Supabase Auth, copy the metadata the
-- signup form collected into public.profiles. The signup server action puts
-- these keys into auth user metadata (see app/actions/auth.ts).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, dob, address, state_of_residence)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'dob')::date, '1900-01-01'),
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    coalesce(new.raw_user_meta_data ->> 'state_of_residence', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═════════════════════════════════════════════════════════════════════════════
-- MONEY-CRITICAL ATOMIC FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════════

-- Called by the Paystack webhook handler (server, secret key) after the
-- webhook signature AND the transaction have been verified with Paystack.
--
-- Atomically (single transaction, row locks):
--   1. Finds the investment by our Paystack reference. Idempotent: calling it
--      twice for the same reference is harmless.
--   2. Verifies the paid amount (in kobo) matches what we expected.
--   3. Marks the investment paid, logs a ledger transaction.
--   4. Adds the amount to the pool. If the pool would OVERFILL (someone else
--      filled it while this user was paying), the investment is flagged
--      refund_pending instead — the admin refunds it from the Paystack
--      dashboard and marks it refunded.
--   5. If the pool just reached its target: sets it active, stamps
--      started_at / ends_at, and generates the full weekly payout schedule
--      for every paid investment in the pool.
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
  -- Lock the investment row so a duplicate webhook can't race us.
  select * into v_inv
  from public.investments
  where paystack_reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'reference_not_found');
  end if;

  -- Idempotency: webhook retries for an already-processed payment are OK.
  if v_inv.status = 'paid' then
    return jsonb_build_object('ok', true, 'reason', 'already_processed');
  end if;

  if v_inv.status <> 'pending_payment' then
    return jsonb_build_object('ok', false, 'reason', 'unexpected_status', 'status', v_inv.status);
  end if;

  -- The amount Paystack says was paid must match what we asked for, to the kobo.
  if p_amount_kobo <> (v_inv.amount * 100)::bigint then
    update public.investments set status = 'amount_mismatch' where id = v_inv.id;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;

  -- Lock the pool row: only one payment can update amount_raised at a time.
  select * into v_pool from public.pools where id = v_inv.pool_id for update;
  select * into v_product from public.pool_products where id = v_pool.product_id;

  v_remaining := v_product.target_amount - v_pool.amount_raised;

  -- Pool already filled / closed while this user was paying → refund path.
  if v_pool.status <> 'open' or v_inv.amount > v_remaining then
    update public.investments set status = 'refund_pending' where id = v_inv.id;
    insert into public.transactions (user_id, type, amount, reference, status, metadata)
    values (v_inv.user_id, 'refund', v_inv.amount, p_reference, 'pending',
            jsonb_build_object('pool_id', v_pool.id, 'reason', 'pool_full'));
    return jsonb_build_object('ok', false, 'reason', 'pool_full_refund_pending');
  end if;

  -- Normal path: confirm the investment.
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

  -- Did this payment fill the pool? Then the clock starts NOW.
  if v_pool.amount_raised >= v_product.target_amount then
    update public.pools
    set status     = 'active',
        started_at = now(),
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks)
    where id = v_pool.id;

    -- Generate the weekly payout schedule for every paid investment.
    -- weekly = trunc(total_return / weeks, 2); the LAST week absorbs the
    -- rounding remainder so each investor receives exactly amount × (1+roi).
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


-- Called by the logged-in USER (via RPC with their own session) to request a
-- withdrawal. Enforced in the database so it cannot be bypassed:
--   • the bank account must belong to the caller,
--   • the account holder name MUST match the profile full name,
--   • the amount must not exceed the available balance,
--   • only one pending request at a time.
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

  select * into v_account from public.withdrawal_accounts
  where id = p_account_id and user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'account_not_found');
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  -- ★ THE NAME-MATCH RULE: bank account name must equal profile name
  --   (case/whitespace-insensitive). If it doesn't match, no withdrawal.
  if lower(regexp_replace(v_account.account_name, '\s+', ' ', 'g'))
     <> lower(regexp_replace(v_profile.full_name, '\s+', ' ', 'g')) then
    return jsonb_build_object('ok', false, 'reason', 'name_mismatch');
  end if;

  -- Only one open request at a time keeps balance accounting simple.
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


-- ═════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Deny-by-default: enabling RLS with no matching policy blocks everything.
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.profiles            enable row level security;
alter table public.withdrawal_accounts enable row level security;
alter table public.pool_products       enable row level security;
alter table public.pools               enable row level security;
alter table public.investments         enable row level security;
alter table public.payouts             enable row level security;
alter table public.withdrawals         enable row level security;
alter table public.transactions        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.app_settings        enable row level security;

-- profiles ────────────────────────────────────────────────────────────────────
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column-level lockdown: even though the row policy lets users update their
-- own row, they may only touch these columns. Crucially they can NOT update
-- `role` (no self-promotion to admin) or `email`/`dob` (identity fields).
revoke update on public.profiles from authenticated;
grant  update (full_name, phone, address, state_of_residence)
  on public.profiles to authenticated;

-- withdrawal_accounts ─────────────────────────────────────────────────────────
drop policy if exists "accounts: read own or admin" on public.withdrawal_accounts;
create policy "accounts: read own or admin" on public.withdrawal_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "accounts: insert own" on public.withdrawal_accounts;
create policy "accounts: insert own" on public.withdrawal_accounts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "accounts: update own" on public.withdrawal_accounts;
create policy "accounts: update own" on public.withdrawal_accounts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "accounts: delete own" on public.withdrawal_accounts;
create policy "accounts: delete own" on public.withdrawal_accounts
  for delete to authenticated
  using (user_id = auth.uid());

-- pool_products ───────────────────────────────────────────────────────────────
-- Everyone logged in can browse active products; admins see all.
-- Writes: server-only (secret key). No insert/update policies on purpose.
drop policy if exists "products: read active or admin" on public.pool_products;
create policy "products: read active or admin" on public.pool_products
  for select to authenticated
  using (active or public.is_admin());

-- pools ───────────────────────────────────────────────────────────────────────
-- Public pools are visible to all logged-in users. Private pools only to their
-- members/creator (and admins). Writes: server-only.
drop policy if exists "pools: read public, member or admin" on public.pools;
create policy "pools: read public, member or admin" on public.pools
  for select to authenticated
  using ((not is_private) or public.is_pool_member(id) or public.is_admin());

-- investments / payouts / withdrawals / transactions ──────────────────────────
-- Users read their own rows; admins read all. ALL writes are server-only.
drop policy if exists "investments: read own or admin" on public.investments;
create policy "investments: read own or admin" on public.investments
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payouts: read own or admin" on public.payouts;
create policy "payouts: read own or admin" on public.payouts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "withdrawals: read own or admin" on public.withdrawals;
create policy "withdrawals: read own or admin" on public.withdrawals
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "transactions: read own or admin" on public.transactions;
create policy "transactions: read own or admin" on public.transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- audit_log ───────────────────────────────────────────────────────────────────
drop policy if exists "audit: admin read only" on public.audit_log;
create policy "audit: admin read only" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- app_settings ────────────────────────────────────────────────────────────────
-- Public, non-sensitive values (e.g. headline interest rate) — readable by
-- everyone including anonymous visitors on the landing page.
drop policy if exists "settings: public read" on public.app_settings;
create policy "settings: public read" on public.app_settings
  for select to anon, authenticated
  using (true);

-- ════════════════════════════════════════════════════════════════════════════
-- DONE. Next steps (see SETUP.md):
--   1. Promote your admin account:
--      UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
--   2. Configure the "Confirm signup" email template to send a 6-digit code
--      ({{ .Token }}) instead of a link.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. CONTACT MESSAGES — submissions from the public "Talk to us" form.
--     Written by the server only (secret key); admins read them in the
--     dashboard under /admin/messages. Also emailed to CONTACT_EMAIL when
--     Resend is configured (see app/actions/contact.ts).
--     If you already ran this file before this table existed, just run this
--     section by itself in the SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  message    text not null,
  handled    boolean not null default false,   -- flipped by admin when dealt with
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "contact: admin read" on public.contact_messages;
create policy "contact: admin read" on public.contact_messages
  for select to authenticated
  using (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. CONTACT REPLIES — replies sent from the admin dashboard to a contact
--     message. Stored for the audit trail (who replied, what was said, when).
--     The actual email goes out from the support inbox via Resend.
--     If you already ran this file, run this section by itself.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_replies (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages (id) on delete cascade,
  admin_id   uuid references public.profiles (id),
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_replies enable row level security;

drop policy if exists "contact replies: admin read" on public.contact_replies;
create policy "contact replies: admin read" on public.contact_replies
  for select to authenticated
  using (public.is_admin());
