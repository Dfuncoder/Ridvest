-- ═══════════════════════════════════════════════════════════════════════════
-- RYDVEST — THE WHOLE DATABASE, IN ONE FILE
--
-- For a BRAND-NEW, EMPTY Supabase project only. It is the twenty files in
-- this folder laid end to end in the order they were applied to the existing
-- database, so a project built from it ends up in the same shape as the one
-- running now — same tables, same row-level security, same functions, same
-- grants.
--
-- ⚠ DO NOT run this against a database that already holds people's money.
--   Every statement is written to be safe to re-run, but there is no reason
--   to take the risk, and no reason to need it: the existing database already
--   has all of this.
--
-- ── HOW TO RUN IT ────────────────────────────────────────────────────────
--   Supabase Dashboard → SQL Editor → paste → Run.
--
--   It is large. If the editor struggles, run it in pieces: every section
--   below starts with a banner naming its source file, and the sections are
--   in dependency order, so stopping after any banner and continuing from
--   the next one is safe.
--
--   Watch for the first error and stop there. A later section failing almost
--   always means an earlier one did not finish.
--
-- ── WHAT IS NOT IN HERE ──────────────────────────────────────────────────
--   1. Two historical migrations are deliberately left out. They convert an
--      OLD database (pool duration in months, Paystack column names) to the
--      shape schema.sql already creates, and their own headers say fresh
--      installs do not need them:
--        • migrate-months-to-weeks.sql
--        • migrate-paystack-to-monnify.sql
--
--   2. Nothing that lives outside the database: the Supabase Auth settings
--      (site URL, redirect allowlist, email templates, SMTP, the
--      password-changed notification), and the environment variables. A new
--      project has none of those, and the app breaks in quiet ways without
--      them. See .env.example.
--
--   3. No data. No users, no pools, no settings beyond the defaults seeded in
--      app_settings. After running this:
--        • sign up on the site with your own email,
--        • then: update public.profiles set role = 'admin' where email = '…';
--        • then set the bank details in /admin/settings and create the pool
--          options in /admin/products.
--
-- ── HOW TO CHECK IT WORKED ───────────────────────────────────────────────
--   select count(*) from information_schema.tables where table_schema='public';
--   select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public';
--   select count(*) from pg_policies where schemaname='public';
--   Run the same three on the existing database and compare the numbers.
-- ═══════════════════════════════════════════════════════════════════════════



-- ████████████████████████████████████████████████████████████████████████
-- SECTION 01 — schema.sql
-- ████████████████████████████████████████████████████████████████████████

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
--    Lifecycle: pending_payment → paid            (normal, via gateway webhook)
--               pending_payment → refund_pending  (pool filled first / amount mismatch)
--               refund_pending  → refunded        (admin refunds in the gateway, marks here)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.investments (
  id                 uuid primary key default gen_random_uuid(),
  pool_id            uuid not null references public.pools (id),
  user_id            uuid not null references public.profiles (id),
  amount             numeric(14,2) not null check (amount > 0),
  status             text not null default 'pending_payment'
                     check (status in ('pending_payment', 'paid', 'refund_pending', 'refunded', 'amount_mismatch')),
  payment_reference  text not null unique,          -- our reference, sent to the gateway; idempotency key
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists investments_pool_idx on public.investments (pool_id);
create index if not exists investments_user_idx on public.investments (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PAYOUTS — the weekly return schedule, generated the moment a pool fills.
--    total return  = amount × (1 + roi/100)
--    weekly        = total / duration_weeks (last week absorbs rounding)
--    first payout  = 2 weeks after the pool fills (week 1 is deployment),
--                    so the schedule runs weeks 2..duration_weeks+1
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

-- Called by the gateway webhook handler (server, secret key) after the
-- webhook signature AND the transaction have both been verified.
--
-- Atomically (single transaction, row locks):
--   1. Finds the investment by our payment reference. Idempotent: calling it
--      twice for the same reference is harmless.
--   2. Verifies the paid amount (in kobo) matches what we expected.
--   3. Marks the investment paid, logs a ledger transaction.
--   4. Adds the amount to the pool. If the pool would OVERFILL (someone else
--      filled it while this user was paying), the investment is flagged
--      refund_pending instead — the admin refunds it from the gateway
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
  where payment_reference = p_reference
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

  -- The amount the gateway says was paid must match what we asked for, to the kobo.
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
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks + 1)
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
      (now() + make_interval(weeks => gs.n + 1))::date
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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 02 — migrate-monnify-to-korapay.sql
-- ████████████████████████████████████████████████████████████████████████

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
  -- Receipt details, filled by the admin at confirmation.
  destination_account text,
  initiator           text,
  narration           text,
  credited_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.deposits add column if not exists destination_account text;
alter table public.deposits add column if not exists initiator           text;
alter table public.deposits add column if not exists narration           text;

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
--    Several can be open at once — each is an independent transfer the admin
--    matches against a separate credit in the bank.
-- ─────────────────────────────────────────────────────────────────────────────
-- If an earlier draft of this migration was applied, drop its signatures —
-- create or replace would otherwise leave a stale overload behind.
drop function if exists public.declare_manual_deposit(numeric, text, text);
drop function if exists public.confirm_manual_deposit(uuid, uuid, numeric);
drop function if exists public.confirm_manual_deposit(uuid, uuid, numeric, text, text, text);

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

  -- A user may legitimately send a second transfer before the first is
  -- confirmed, so waiting on one does not block the next. The cap only stops
  -- someone hammering the button and flooding the admin queue.
  if (
    select count(*) from public.deposits
    where user_id = v_uid and status = 'awaiting_confirmation'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_pending_deposits');
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
  p_deposit_id          uuid,
  p_admin_id            uuid,
  p_actual_amount       numeric,
  p_destination_account text default null,
  p_initiator           text default null,
  p_narration           text default null
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
  set status              = 'credited',
      amount              = coalesce(amount, v_amount),
      credited_amount     = v_amount,
      confirmed_by        = p_admin_id,
      confirm_token       = null,
      destination_account = nullif(btrim(coalesce(p_destination_account, '')), ''),
      initiator           = nullif(btrim(coalesce(p_initiator, '')), ''),
      narration           = nullif(btrim(coalesce(p_narration, '')), ''),
      credited_at         = now()
  where id = v_dep.id;

  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_dep.user_id, 'deposit', v_amount, v_dep.reference, 'success',
          jsonb_build_object('method', 'manual', 'confirmed_by', p_admin_id));

  return jsonb_build_object(
    'ok', true,
    'amount', v_amount,
    'user_id', v_dep.user_id,
    'reference', v_dep.reference,
    'initiated_at', v_dep.created_at
  );
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
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks + 1)
    where id = v_pool.id;

    -- Payouts run weeks 2..N+1: the first week after funding is for
    -- deploying the vehicle, so nothing is due then. ends_at moves out by the
    -- same week so it still lands on the final payout.
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
revoke all on function public.confirm_manual_deposit(uuid, uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.reject_manual_deposit(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.apply_paid_deposit(text, bigint) to service_role;
grant execute on function public.confirm_manual_deposit(uuid, uuid, numeric, text, text, text) to service_role;
grant execute on function public.reject_manual_deposit(uuid, uuid, text) to service_role;

-- These two read auth.uid(), so users call them with their own session.
grant execute on function public.declare_manual_deposit(text, text) to authenticated;
grant execute on function public.join_pool_from_balance(uuid, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10b. NAME MATCHING (same definitions as migrate-bank-name-match.sql).
--
--      Duplicated deliberately: request_withdrawal below depends on them, and
--      without them here a re-run of this file would replace the token rule
--      with the old exact-string comparison and break every withdrawal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.name_tokens(p_name text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select t
      from unnest(
        string_to_array(
          btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )
      ) as t
      where length(t) >= 2
        and t <> all (array['mr','mrs','miss','ms','dr','chief','alhaji','engr','prof'])
    ),
    array[]::text[]
  );
$$;

create or replace function public.names_match(p_account_name text, p_profile_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_account text[] := public.name_tokens(p_account_name);
  v_profile text[] := public.name_tokens(p_profile_name);
begin
  if array_length(v_profile, 1) is null or array_length(v_account, 1) is null then
    return false;
  end if;
  return v_profile <@ v_account;
end;
$$;

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

  -- ★ THE NAME-MATCH RULE, token-based: every meaningful word of the profile
  --   name must appear in the bank account name.
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
        ends_at    = now() + make_interval(weeks => v_product.duration_weeks + 1)
    where id = v_pool.id;

    -- Payouts run weeks 2..N+1: the first week after funding is for
    -- deploying the vehicle, so nothing is due then. ends_at moves out by the
    -- same week so it still lands on the final payout.
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
  end if;

  return jsonb_build_object('ok', true, 'pool_status', v_pool.status);
end;
$$;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 03 — migrate-add-user-codes.sql
-- ████████████████████████████████████████████████████████████████████████

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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 04 — migrate-bank-name-match.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- BANK NAME MATCHING — token comparison instead of an exact string match.
--
-- Withdrawal account names now come from Korapay's account-resolve API rather
-- than from the user typing them, which is far stronger evidence of ownership.
-- But banks return the full legal name in their own order:
--
--   profile  "Jude Mbakwe"
--   bank     "MBAKWE JUDE CHUKWUEMEKA"
--
-- The old rule compared those two strings for equality and would have rejected
-- every real account. The new rule requires every meaningful word of the
-- profile name to appear in the account name.
--
-- Mirrors lib/names.ts — change both together.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- Bank codes are needed to resolve an account, so keep the one we used.
alter table public.withdrawal_accounts add column if not exists bank_code text;

-- Records that the stored name came from the bank rather than from the user.
alter table public.withdrawal_accounts
  add column if not exists name_verified boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Words that carry no identifying information.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.name_tokens(p_name text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select t
      from unnest(
        string_to_array(
          btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )
      ) as t
      where length(t) >= 2
        and t <> all (array['mr','mrs','miss','ms','dr','chief','alhaji','engr','prof'])
    ),
    array[]::text[]
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Every meaningful word of the profile name must appear in the account name.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.names_match(p_account_name text, p_profile_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_account text[] := public.name_tokens(p_account_name);
  v_profile text[] := public.name_tokens(p_profile_name);
begin
  if array_length(v_profile, 1) is null or array_length(v_account, 1) is null then
    return false;
  end if;
  return v_profile <@ v_account;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- request_withdrawal now uses names_match(). Everything else is unchanged,
-- including the profile row lock that stops a withdrawal and a pool join from
-- spending the same balance.
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

  perform 1 from public.profiles where id = v_uid for update;

  select * into v_account from public.withdrawal_accounts
  where id = p_account_id and user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'account_not_found');
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  -- ★ THE NAME-MATCH RULE, now token-based.
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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 05 — migrate-product-visibility.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT VISIBILITY — a user can always read the product behind their own
-- money.
--
-- The old policy was:
--
--   using (active or public.is_admin())
--
-- so the moment an admin deactivated a pool option, every investor in a pool
-- built on it lost the ability to read it. The dashboard embeds the product
-- alongside each investment, PostgREST returned product: null, and the page
-- crashed reading roi_percent off null.
--
-- Deactivating a product is meant to stop NEW pools using it, not to hide an
-- investment someone already holds. This widens the read to cover products the
-- caller has money in, or has a pool of their own built on.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.has_stake_in_product(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    -- An investment in any pool built on this product.
    select 1
    from public.investments i
    join public.pools p on p.id = i.pool_id
    where i.user_id = auth.uid()
      and p.product_id = p_product_id
  )
  or exists (
    -- Or a pool of their own built on it, even before anyone has funded it.
    select 1 from public.pools
    where product_id = p_product_id
      and created_by = auth.uid()
  );
$$;

grant execute on function public.has_stake_in_product(uuid) to authenticated;

drop policy if exists "products: read active or admin" on public.pool_products;
drop policy if exists "products: read active, own stake, or admin" on public.pool_products;

create policy "products: read active, own stake, or admin" on public.pool_products
  for select to authenticated
  using (active or public.is_admin() or public.has_stake_in_product(id));


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 06 — migrate-inactivity-timeout.sql
-- ████████████████████████████████████████████████████████████████████████

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

-- New signups start their clock at creation, so a fresh account is never
-- judged against a NULL.
alter table public.profiles alter column last_active_at set default now();

-- Existing sessions start their clock now rather than being logged out at once.
-- Start everyone's clock at migration time rather than leaving NULLs.
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
  -- Checked FIRST so a zero window is a true kill switch: it has to let the
  -- request through even when the caller looks unauthenticated to Postgres.
  -- Putting the auth check above this made SESSION_IDLE_MINUTES=0 useless as
  -- an emergency off switch, which is the one moment it matters.
  if p_timeout_minutes is null or p_timeout_minutes <= 0 then
    if v_uid is not null then
      update public.profiles set last_active_at = now() where id = v_uid;
    end if;
    return jsonb_build_object('ok', true, 'reason', 'disabled');
  end if;

  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 07 — migrate-hide-balance.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- HIDE BALANCE — a saved preference, not a per-browser one.
--
-- Both the user dashboard and the admin overview can blank their money
-- figures. Storing the choice on the profile means it is read on the server
-- with everything else, so the page renders already masked — there is no
-- moment where the real figures are painted and then hidden — and it follows
-- the account to any device.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists hide_balance boolean not null default false;

-- Column-level grants are the lockdown on this table (see supabase/schema.sql):
-- the row policy lets a user update their own row, but only the columns named
-- here. Re-granted in full because GRANT on a column list replaces nothing —
-- it adds — and listing them together keeps the allowed set in one place.
grant update (full_name, phone, address, state_of_residence, hide_balance)
  on public.profiles to authenticated;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 08 — migrate-auto-payouts.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTOMATIC PAYOUTS, AND REVERSING A BAD ONE
--
-- Payouts used to be credited only when an admin clicked "mark paid" on each
-- one, which meant an investor's money arrived when somebody remembered. They
-- now settle on their due date, driven by a scheduled call to
-- settle_due_payouts() (see app/api/cron/payouts).
--
-- Because nobody approves each credit any more, there has to be a way back
-- out: revert_payout() takes a credited payout off the balance again, for a
-- payout that was wrong, duplicated or fraudulent.
--
-- A reverted payout goes to its own terminal status rather than back to
-- 'scheduled', so the next automatic run does not simply pay it again.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payouts add column if not exists reverted_at timestamptz;
alter table public.payouts add column if not exists reverted_by uuid references public.profiles (id);
alter table public.payouts add column if not exists admin_note text;

alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add constraint payouts_status_check
  check (status in ('scheduled', 'paid', 'reverted'));

-- available_balance() counts payouts with status 'paid', so 'reverted' drops
-- out of the balance automatically — no separate reversal entry is needed for
-- the arithmetic. The transactions row written below is the audit record.

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTLE EVERYTHING DUE
--
-- Idempotent by construction: it only ever touches rows still 'scheduled', so
-- running it twice in a day, or re-running after a failure, cannot double-pay.
-- The update and the ledger insert share one transaction.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.settle_due_payouts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_total numeric := 0;
begin
  with due as (
    select id, user_id, amount, pool_id
    from public.payouts
    where status = 'scheduled'
      and due_date <= current_date
    -- Skip anything another run already has in hand.
    for update skip locked
  ),
  settled as (
    update public.payouts p
    set status = 'paid', paid_at = now()
    from due
    where p.id = due.id
    returning p.id, p.user_id, p.amount, p.pool_id
  ),
  logged as (
    insert into public.transactions (user_id, type, amount, reference, status, metadata)
    select user_id, 'payout', amount, id::text, 'success',
           jsonb_build_object('pool_id', pool_id, 'settled', 'auto')
    from settled
    returning amount
  )
  select count(*), coalesce(sum(amount), 0) into v_count, v_total from logged;

  return jsonb_build_object('ok', true, 'count', v_count, 'total', v_total);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REVERT A CREDITED PAYOUT
--
-- Does NOT refuse when it would push the balance negative. A payout credited
-- in error and then withdrawn is exactly the case this exists for, and leaving
-- the money credited because the arithmetic is awkward would be worse. The
-- resulting balance is returned so the admin can see what they are left with.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.revert_payout(
  p_payout_id uuid,
  p_admin_id  uuid,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout  public.payouts%rowtype;
  v_balance numeric;
begin
  select * into v_payout from public.payouts where id = p_payout_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'payout_not_found');
  end if;

  if v_payout.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid', 'status', v_payout.status);
  end if;

  update public.payouts
  set status      = 'reverted',
      reverted_at = now(),
      reverted_by = p_admin_id,
      admin_note  = nullif(btrim(coalesce(p_reason, '')), ''),
      paid_at     = null
  where id = v_payout.id;

  -- Negative amount: the ledger should show the money leaving again, not the
  -- original credit quietly disappearing.
  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (v_payout.user_id, 'payout', -v_payout.amount, v_payout.id::text, 'success',
          jsonb_build_object('pool_id', v_payout.pool_id, 'reverted_by', p_admin_id,
                             'reason', p_reason));

  v_balance := public.available_balance(v_payout.user_id);

  return jsonb_build_object(
    'ok', true,
    'amount', v_payout.amount,
    'user_id', v_payout.user_id,
    'balance_after', v_balance
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PUT A REVERTED PAYOUT BACK IN THE QUEUE
-- For when the revert itself was the mistake.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.restore_payout(
  p_payout_id uuid,
  p_admin_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
begin
  select * into v_payout from public.payouts where id = p_payout_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'payout_not_found');
  end if;

  if v_payout.status <> 'reverted' then
    return jsonb_build_object('ok', false, 'reason', 'not_reverted', 'status', v_payout.status);
  end if;

  -- Back to 'scheduled', so the next automatic run settles it on its merits
  -- rather than this restoring a credit nobody re-checked.
  update public.payouts
  set status      = 'scheduled',
      reverted_at = null,
      reverted_by = null,
      admin_note  = null
  where id = v_payout.id;

  return jsonb_build_object('ok', true, 'user_id', v_payout.user_id);
end;
$$;

-- These move money, so they are server-only.
revoke all on function public.settle_due_payouts() from public, anon, authenticated;
revoke all on function public.revert_payout(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.restore_payout(uuid, uuid) from public, anon, authenticated;

grant execute on function public.settle_due_payouts() to service_role;
grant execute on function public.revert_payout(uuid, uuid, text) to service_role;
grant execute on function public.restore_payout(uuid, uuid) to service_role;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 09 — migrate-withdrawal-audit.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- WITHDRAWAL AUDIT — who approved it, who paid it.
--
-- A withdrawal recorded only that it had been processed, never by whom. For
-- money leaving the platform to a bank account, "which admin did this and
-- when" is the first question anyone asks when something is disputed, and the
-- audit_log alone makes you join by hand.
--
-- Two actors are recorded because they are often different people: one admin
-- approves, another sends the transfer and marks it paid.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.withdrawals
  add column if not exists approved_by uuid references public.profiles (id);

alter table public.withdrawals
  add column if not exists approved_at timestamptz;

alter table public.withdrawals
  add column if not exists processed_by uuid references public.profiles (id);

-- Writes go through server actions using the service role, so no grants change.


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 10 — migrate-user-lock.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- LOCKING AN ACCOUNT
--
-- A locked account can still exist and keep all its records; it just cannot be
-- used. That is the answer for a suspected-fraud or disputed account, where
-- deleting would destroy exactly the evidence you need.
--
-- Enforced in two places on purpose:
--   • requireUser() in lib/auth.ts signs a locked user straight back out, so
--     no page or server action runs for them at all;
--   • the money functions below refuse regardless, so a crafted request that
--     somehow skipped the app cannot move a locked account's money.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists locked_at timestamptz;
alter table public.profiles add column if not exists locked_by uuid references public.profiles (id);
alter table public.profiles add column if not exists lock_reason text;

-- The user must never be able to clear their own lock. Column grants are the
-- lockdown on this table (see supabase/schema.sql), and these are not listed.
grant update (full_name, phone, address, state_of_residence, hide_balance)
  on public.profiles to authenticated;

create or replace function public.is_locked(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and locked_at is not null
  );
$$;

grant execute on function public.is_locked(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Money functions refuse for a locked account.
--
-- Each is otherwise byte-identical to its current definition; only the guard is
-- new. They are reproduced in full because CREATE OR REPLACE has no way to
-- patch a function body.
-- ─────────────────────────────────────────────────────────────────────────────

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

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  if (
    select count(*) from public.deposits
    where user_id = v_uid and status = 'awaiting_confirmation'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_pending_deposits');
  end if;

  insert into public.deposits (user_id, method, status, reference, confirm_token)
  values (v_uid, 'manual', 'awaiting_confirmation', p_reference, p_token)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'deposit_id', v_id);
end;
$$;

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

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
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

-- join_pool_from_balance gets the same guard. Only the two lines after the
-- auth check are new.
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

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
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

grant execute on function public.declare_manual_deposit(text, text) to authenticated;
grant execute on function public.request_withdrawal(uuid, numeric) to authenticated;
grant execute on function public.join_pool_from_balance(uuid, numeric) to authenticated;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 11 — migrate-product-images.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT IMAGES — so a keke pool does not look like a minibus pool.
--
-- One nullable column. When it is null the app falls back to matching the
-- product name against its catalogue (lib/vehicles.ts), so every pool option
-- that already exists gets the right picture without an admin touching it.
-- Setting the column overrides that guess.
--
-- The value is a path under /public, not a URL, so the images stay bundled and
-- served by Next's optimiser. Nothing here is user-supplied: the admin form
-- offers a fixed list.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pool_products
  add column if not exists image_path text;

comment on column public.pool_products.image_path is
  'Path under /public for the vehicle photo, e.g. /header_image.png. '
  'Null means: work it out from the product name (lib/vehicles.ts).';

-- No grant needed: pool_products is granted at table level, which covers
-- columns added later, and the existing "products: read active or admin"
-- policy still decides which rows anyone sees.


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 12 — migrate-private-pool-rules.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVATE POOL RULES
--
-- Two changes, both about pools a user starts for themselves:
--
--   1. Only an admin can open a PUBLIC pool. Anything a user creates is
--      private and reachable only through its invite code. Enforced by a
--      trigger rather than only in the server action, so the rule survives any
--      future code path that inserts a pool.
--
--   2. Investing in a PRIVATE pool has a floor of ₦500,000 per contribution,
--      regardless of the product's own minimum. Public pools keep using the
--      product minimum, which is what makes them the way in for smaller
--      investors.
--
-- The one-open-pool-at-a-time rule already lives in createPool() and is
-- unchanged here.
--
-- ⚠ RUN ORDER: after supabase/migrate-user-lock.sql, whose version of
--   join_pool_from_balance() this reproduces and extends.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- The floor. Mirrored in lib/economics.ts for the forms — change both together.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.private_pool_minimum()
returns numeric
language sql
immutable
as $$
  select 500000::numeric;
$$;

comment on function public.private_pool_minimum() is
  'Smallest contribution allowed into a private pool. Mirrored by '
  'PRIVATE_POOL_MINIMUM in lib/economics.ts.';

grant execute on function public.private_pool_minimum() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- A pool created by a non-admin is private, always.
--
-- A trigger rather than a CHECK, because the rule depends on who is acting.
-- An admin-created pool (is_admin() true) is left exactly as inserted, so
-- createOfficialPool() can still open public pools. An insert with no session
-- at all — a migration or a direct psql fix — is also left alone.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.force_private_user_pools()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_private := true;
  end if;
  return new;
end;
$$;

drop trigger if exists pools_force_private on public.pools;
create trigger pools_force_private
  before insert on public.pools
  for each row
  execute function public.force_private_user_pools();

-- ─────────────────────────────────────────────────────────────────────────────
-- join_pool_from_balance — now with the private-pool floor.
--
-- Reproduced in full because CREATE OR REPLACE cannot patch a body. Identical
-- to the version in migrate-user-lock.sql apart from v_minimum, and the
-- 'minimum' now returned alongside amount_too_small so the form can say which
-- figure it means.
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
  v_minimum   numeric;
  v_balance   numeric;
  v_inv_id    uuid;
  v_ref       text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
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

  -- A private pool asks for more per person than the product's own minimum.
  v_minimum := case
    when v_pool.is_private
      then greatest(v_product.min_contribution, public.private_pool_minimum())
    else v_product.min_contribution
  end;

  -- The minimum is waived only when topping off the last slice of the pool,
  -- otherwise a pool whose remainder is below the floor could never fill.
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

grant execute on function public.join_pool_from_balance(uuid, numeric) to authenticated;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 13 — migrate-kyc.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- KYC — identity verification before money can leave the platform.
--
-- A user submits an NIN or BVN plus a selfie taken on camera. An admin
-- compares the two and approves or rejects. Until there is an approved
-- submission, request_withdrawal() refuses.
--
-- Deliberately gates WITHDRAWAL only. Depositing and investing stay open, so
-- somebody can get started while verification is pending; the check lands at
-- the point money would actually leave.
--
-- ⚠ RUN ORDER: this must run AFTER supabase/migrate-user-lock.sql, because it
--   re-creates request_withdrawal() and carries that migration's is_locked()
--   guard forward. Running it first would create a function that calls
--   is_locked() before that function exists, and every withdrawal would fail.
--
-- THE ID NUMBER IS ENCRYPTED, NOT HASHED.
--   id_number_encrypted holds AES-256-GCM ciphertext produced by lib/crypto.ts.
--   The key lives in the KYC_ENCRYPTION_KEY environment variable and never in
--   this database, so a dumped table or a leaked backup is useless on its own.
--   An admin reveals a number through a server action that decrypts it and
--   writes an audit_log row, so every look is attributable.
--
--   id_number_last4 is kept in the clear so screens can show ·······1234 and
--   support can match a number read out over the phone, without a decrypt and
--   without an audit entry for routine browsing.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PREFLIGHT — carry an earlier install of this table forward.
--
-- The first version of this migration stored the number in plain text in
-- id_number. If that is what is on disk, move the column aside rather than
-- dropping it: the values cannot be encrypted from here (no key in SQL), so
-- they are preserved for a one-off backfill and the digit CHECK is removed.
-- ─────────────────────────────────────────────────────────────────────────────
do $preflight$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kyc_submissions'
      and column_name = 'id_number'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kyc_submissions'
      and column_name = 'id_number_encrypted'
  ) then
    alter table public.kyc_submissions
      drop constraint if exists kyc_submissions_id_number_check;

    alter table public.kyc_submissions
      rename column id_number to id_number_plaintext_legacy;

    -- RENAMING KEEPS THE COLUMN'S NOT NULL. Without this line every future
    -- insert has to supply a plaintext NIN — which the app deliberately never
    -- writes — so submissions fail with a not-null violation on a column
    -- nobody is meant to use again.
    alter table public.kyc_submissions
      alter column id_number_plaintext_legacy drop not null;

    alter table public.kyc_submissions
      add column id_number_encrypted text,
      add column id_number_last4 text;

    -- The last 4 can be derived without the key; the ciphertext cannot.
    update public.kyc_submissions
      set id_number_last4 = right(id_number_plaintext_legacy, 4)
      where id_number_last4 is null;

    raise notice
      'kyc_submissions: id_number preserved as id_number_plaintext_legacy. Encrypt those rows, then: ALTER TABLE public.kyc_submissions DROP COLUMN id_number_plaintext_legacy;';
  end if;
end
$preflight$;

create table if not exists public.kyc_submissions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  id_type             text not null check (id_type in ('nin', 'bvn')),
  -- AES-256-GCM from lib/crypto.ts: version.iv.tag.ciphertext, base64url.
  -- Bound to user_id, so it cannot be moved to another row and still decrypt.
  id_number_encrypted text not null,
  -- Shown on screens. Four digits does not identify anybody on its own.
  id_number_last4     text not null check (id_number_last4 ~ '^[0-9]{4}$'),
  -- Object path inside the private 'kyc' storage bucket.
  selfie_path         text not null,
  status              text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
  admin_note          text,
  reviewed_by         uuid references public.profiles (id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);

-- For an install coming through the preflight above, the columns exist but are
-- nullable. Tighten them once there is nothing left to backfill.
do $tighten$
begin
  if not exists (
    select 1 from public.kyc_submissions
    where id_number_encrypted is null or id_number_last4 is null
  ) then
    alter table public.kyc_submissions
      alter column id_number_encrypted set not null,
      alter column id_number_last4 set not null;
  else
    raise notice
      'kyc_submissions: NOT NULL not applied — some rows still lack id_number_encrypted. Re-run this file after backfilling.';
  end if;
end
$tighten$;

create index if not exists kyc_user_idx   on public.kyc_submissions (user_id, created_at desc);
create index if not exists kyc_status_idx on public.kyc_submissions (status, created_at desc);

-- One submission awaiting review at a time, so the queue cannot be flooded.
create unique index if not exists kyc_one_pending_per_user
  on public.kyc_submissions (user_id)
  where status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- Private bucket for the selfies. Nothing is served publicly; the admin screen
-- fetches short-lived signed URLs through the service role.
--
-- No policies are created on storage.objects for this bucket, and that is the
-- point: with none, no logged-in user can read or write it directly. Uploads
-- happen in submitKyc() and links are signed in the admin page, both with the
-- service role, which bypasses RLS. The size and type limits below are a
-- second line of defence behind the checks in submitKyc().
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 1000000, array['image/jpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 1000000,
      allowed_mime_types = array['image/jpeg'];

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — a user sees their own submissions and nothing else. Every write goes
-- through a server action using the service role.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.kyc_submissions enable row level security;

drop policy if exists "kyc: read own or admin" on public.kyc_submissions;
create policy "kyc: read own or admin" on public.kyc_submissions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Column grants, narrower than the row policy: nobody reaches the ciphertext
-- over the user API at all, not even for their own row. It is only ever read
-- by the service role inside revealKycNumber(). Belt and braces — the value is
-- useless without the key, but there is no reason to serve it.
revoke select on public.kyc_submissions from authenticated;
grant select (
  id, user_id, id_type, id_number_last4, selfie_path,
  status, admin_note, reviewed_by, reviewed_at, created_at
) on public.kyc_submissions to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Has this user been verified?
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_approved_kyc(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.kyc_submissions
    where user_id = p_user_id and status = 'approved'
  );
$$;

grant execute on function public.has_approved_kyc(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- request_withdrawal now also requires verification.
--
-- Reproduced in full because CREATE OR REPLACE cannot patch a body. Identical
-- to the version in migrate-user-lock.sql apart from the KYC guard.
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

  if public.is_locked(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'account_locked');
  end if;

  -- The gate: no approved KYC, no money out.
  if not public.has_approved_kyc(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'kyc_required');
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

grant execute on function public.request_withdrawal(uuid, numeric) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS DOES AND DOES NOT PROTECT AGAINST
--
-- Protected: a stolen database backup, a leaked read-only Postgres
-- credential, a misconfigured RLS policy, an SQL injection that reads rows.
-- All of those now yield ciphertext.
--
-- Not protected: anything that can read the application's environment — the
-- Vercel project settings, a compromised deploy, or a logged-in admin using
-- the reveal button. Those are what the audit_log and a short admin list are
-- for.
--
-- Still worth doing eventually: verify the number against a NIMC/NIBSS
-- provider and store only their verdict and a reference. Then there is no
-- number to protect, which beats protecting one well.
-- ═══════════════════════════════════════════════════════════════════════════


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 14 — migrate-kyc-legacy-column-fix.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: every KYC submission failing with a not-null violation
--
-- SYMPTOM
--   The user sees "Couldn't submit your details. Please try again." The server
--   log shows:
--     null value in column "id_number_plaintext_legacy" of relation
--     "kyc_submissions" violates not-null constraint
--
-- CAUSE
--   The first version of migrate-kyc.sql stored the NIN in plain text in a
--   NOT NULL column called id_number. The rewritten version moves that column
--   aside as id_number_plaintext_legacy and stores an encrypted value instead
--   — but RENAMING A COLUMN KEEPS ITS NOT NULL. So the old column survived as
--   a required field that the app, quite correctly, never writes to again.
--   Every insert then failed.
--
--   migrate-kyc.sql now drops that NOT NULL during the rename, so a database
--   migrated from scratch is unaffected. This file repairs one that already
--   went through the broken version.
--
-- WHAT IT DOES
--   Drops the legacy column outright when it holds nothing worth keeping.
--   If it still holds plaintext NINs, the column is kept and only its NOT NULL
--   is dropped — losing real identity data to fix a constraint would be a
--   worse bug than the one being fixed. Re-run this file after those rows have
--   been encrypted and cleared, and it will finish the job.
--
-- Safe to re-run. Does nothing on a database that never had the old column.
-- ═══════════════════════════════════════════════════════════════════════════

do $fix$
declare
  v_rows bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kyc_submissions'
      and column_name = 'id_number_plaintext_legacy'
  ) then
    raise notice 'kyc_submissions: no legacy column — nothing to fix.';
    return;
  end if;

  -- Unblock inserts first, whatever else is decided below.
  alter table public.kyc_submissions
    alter column id_number_plaintext_legacy drop not null;

  execute
    'select count(*) from public.kyc_submissions where id_number_plaintext_legacy is not null'
    into v_rows;

  if v_rows = 0 then
    alter table public.kyc_submissions drop column id_number_plaintext_legacy;
    raise notice 'kyc_submissions: legacy column was empty and has been dropped. Submissions will work now.';
  else
    raise notice
      'kyc_submissions: NOT NULL dropped so submissions work again, but % row(s) still hold a plaintext NIN. Encrypt or clear them, then re-run this file to drop the column.',
      v_rows;
  end if;
end
$fix$;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 15 — migrate-nin-verification.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- NIN-ONLY KYC, CHECKED AGAINST NIMC
--
-- Two changes to how verification works:
--
--   1. BVN is dropped. NIN only.
--
--   2. The number is no longer just stored and eyeballed. After a submission
--      lands, the app asks Monnify to look the NIN up with NIMC, and records
--      the names that come back. The admin then sees the name on the national
--      record beside the name on the profile, and whether they match —
--      which is the difference between "a number was typed" and "this number
--      belongs to this person".
--
-- The check runs in the background, so a submission is 'pending' with
-- lookup_status 'checking' for the few seconds to a few minutes it takes, and
-- the user is told as much.
--
-- WHAT THE ADMIN STILL DECIDES
--   The lookup says whether the NIN is real and whose it is. It cannot say
--   whether the face in the selfie is that person. Approval stays manual on
--   purpose — this gives the admin evidence, not a verdict.
--
-- ⚠ RUN ORDER: after supabase/migrate-kyc.sql.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NIN ONLY
--
-- Any BVN submission still sitting in the table is left alone rather than
-- rewritten — it is a record of what somebody actually sent. The constraint
-- only binds new rows.
-- ─────────────────────────────────────────────────────────────────────────────
do $bvn$
begin
  if exists (
    select 1 from public.kyc_submissions where id_type = 'bvn'
  ) then
    raise notice
      'kyc_submissions: % BVN submission(s) kept as history; new rows must be NIN.',
      (select count(*) from public.kyc_submissions where id_type = 'bvn');
  end if;
end
$bvn$;

alter table public.kyc_submissions
  alter column id_type set default 'nin';

-- Old rows may say 'bvn'; new ones may not. A CHECK cannot express that, so
-- the rule goes on insert.
alter table public.kyc_submissions
  drop constraint if exists kyc_submissions_id_type_check;
alter table public.kyc_submissions
  add constraint kyc_submissions_id_type_check check (id_type in ('nin', 'bvn'));

create or replace function public.kyc_nin_only()
returns trigger
language plpgsql
as $$
begin
  if new.id_type is distinct from 'nin' then
    raise exception 'Only NIN submissions are accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists kyc_submissions_nin_only on public.kyc_submissions;
create trigger kyc_submissions_nin_only
  before insert on public.kyc_submissions
  for each row
  execute function public.kyc_nin_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WHAT NIMC SAID
--
-- Names come back in the clear: they are what the admin has to read, and they
-- are no more sensitive than the name already on the profile. The NIN itself
-- stays encrypted (lib/crypto.ts) — that is the identifier worth protecting.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.kyc_submissions
  -- 'none'     — not looked up yet (old rows)
  -- 'checking' — the background lookup is running
  -- 'matched'  — NIMC returned a record and the names match the profile
  -- 'mismatch' — NIMC returned a record and the names do NOT match
  -- 'not_found'— NIMC has no such NIN
  -- 'failed'   — we could not complete the check (see lookup_error)
  add column if not exists lookup_status   text not null default 'none',
  add column if not exists lookup_first_name text,
  add column if not exists lookup_last_name  text,
  add column if not exists lookup_dob        text,
  add column if not exists lookup_gender     text,
  add column if not exists lookup_phone      text,
  add column if not exists lookup_error      text,
  add column if not exists lookup_at         timestamptz;

alter table public.kyc_submissions
  drop constraint if exists kyc_submissions_lookup_status_check;
alter table public.kyc_submissions
  add constraint kyc_submissions_lookup_status_check
  check (lookup_status in ('none', 'checking', 'matched', 'mismatch', 'not_found', 'failed'));

create index if not exists kyc_lookup_status_idx
  on public.kyc_submissions (lookup_status, created_at desc);

-- NOTHING about the NIN check is served to the user API — not the outcome,
-- not even that a check happened.
--
-- Telling somebody their number is "being checked" tells them it is checked at
-- all, which is a hint anyone probing with a borrowed or invented NIN can use:
-- submit, watch, and learn what passes. The lookup columns are for the admin
-- screen, which reads through the service role and bypasses these grants.
--
-- A user sees exactly what they saw before: submitted, approved, or turned
-- down with a reason.
revoke select on public.kyc_submissions from authenticated;
grant select (
  id, user_id, id_type, id_number_last4, selfie_path,
  status, admin_note, reviewed_by, reviewed_at, created_at
) on public.kyc_submissions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- WHAT THIS PROVES, AND WHAT IT DOES NOT
--
-- Proves: the NIN exists on the national register, and the name on it. If that
-- name does not match the profile, the submission is somebody else's NIN.
--
-- Does not prove: that the person who submitted it is that person. A real NIN
-- belonging to a real relative still passes the lookup. The selfie, and an
-- admin looking at it, is what is meant to catch that — which is why approval
-- is still a human decision and not automatic on 'matched'.
-- ═══════════════════════════════════════════════════════════════════════════


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 16 — migrate-kyc-retention.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- KYC SELFIE RETENTION — stopping the storage bucket growing without end.
--
-- Three things pile up in the 'kyc' bucket if nothing removes them:
--
--   1. ORPHANS. The selfie is uploaded before the row is inserted, on purpose
--      — a row pointing at a missing image is worse than an image nobody
--      references. When an insert then fails, the image stays behind. The
--      not-null bug fixed in migrate-kyc-legacy-column-fix.sql produced one of
--      these for every attempted submission.
--
--   2. REJECTED ATTEMPTS. Somebody submits a blurry photo four times before
--      the fifth is accepted. The four failures are of no further use once
--      the user has had a fair chance to re-submit.
--
--   3. SUPERSEDED ATTEMPTS. Earlier submissions by a user who is now approved.
--
-- WHAT IS NEVER DELETED
--   The selfie on an APPROVED submission, and every submission ROW. The row is
--   the audit trail — who was verified, by which admin, when, and against what
--   NIN — and it is small. Only images are removed, and only ones that no
--   longer evidence anything. Nigerian AML guidance expects identity records
--   to be retained for years after an account closes; this keeps the record
--   and drops the clutter.
--
-- HOW IT RUNS
--   This function only reports WHICH objects may go. Storage deletion happens
--   in /api/cron/kyc-cleanup, because removing an object needs the storage
--   API, not SQL. Marking is separated from deleting so a failed delete simply
--   retries next run rather than losing track of what was meant to go.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- How long a rejected or superseded attempt keeps its photo.
create or replace function public.kyc_selfie_retention_days()
returns integer
language sql
immutable
as $$
  select 30;
$$;

-- Records that an image is gone, so the row stays honest about what it holds.
alter table public.kyc_submissions
  add column if not exists selfie_deleted_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Which stored selfies are no longer worth keeping.
--
-- Returns the object paths. Rows are left in place; only the image goes.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.expired_kyc_selfies()
returns table (id uuid, selfie_path text)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.selfie_path
  from public.kyc_submissions s
  where s.selfie_deleted_at is null
    and s.selfie_path is not null
    -- Never an approved submission: that photo is the evidence.
    and s.status <> 'approved'
    -- Rejected long enough ago that the user has had their chance to retry,
    -- OR already superseded by an approval on the same account.
    and (
      (s.status = 'rejected'
        and coalesce(s.reviewed_at, s.created_at)
            < now() - make_interval(days => public.kyc_selfie_retention_days()))
      or exists (
        select 1 from public.kyc_submissions a
        where a.user_id = s.user_id
          and a.status = 'approved'
          and a.id <> s.id
      )
    );
$$;

grant execute on function public.expired_kyc_selfies() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Called once the object really is gone from storage.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_kyc_selfie_deleted(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.kyc_submissions
  set selfie_deleted_at = now()
  where id = any(p_ids) and selfie_deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_kyc_selfie_deleted(uuid[]) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Every path any row has ever pointed at, so the cleanup can tell an orphan
-- from an image that belongs to somebody. An orphan is an object NO row
-- mentions at all.
--
-- ⚠ There is deliberately no `selfie_deleted_at is null` filter here, and
--   that matters. With one, a row whose image had been marked deleted would
--   drop out of this list, its path would look unreferenced, and the orphan
--   sweep would delete the file — which for an approved submission would mean
--   destroying the evidence. Listing every path means the orphan sweep can
--   only ever touch objects belonging to no row whatsoever.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.referenced_kyc_selfies()
returns table (selfie_path text)
language sql
security definer
set search_path = public
stable
as $$
  select s.selfie_path
  from public.kyc_submissions s
  where s.selfie_path is not null;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Every approved submission's photo. The cleanup re-checks its delete list
-- against this before removing anything — a second, independent guard, so
-- losing an approved selfie would take BOTH this and the `status <> 'approved'`
-- filter above being wrong at the same time.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.approved_kyc_selfies()
returns table (selfie_path text)
language sql
security definer
set search_path = public
stable
as $$
  select s.selfie_path
  from public.kyc_submissions s
  where s.selfie_path is not null
    and s.status = 'approved';
$$;

grant execute on function public.approved_kyc_selfies() to service_role;

grant execute on function public.referenced_kyc_selfies() to service_role;


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 17 — migrate-internal-transfers.sql
-- ████████████████████████████████████████████████████████████████████████

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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 18 — migrate-pin-and-transfer-fee.sql
-- ████████████████████████████████████████████████████████████████████████

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


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 19 — migrate-pool-product-details.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- POOL OPTIONS: WHO CAN USE THEM, AND WHAT THEY ARE MADE OF
--
-- ── 1. SEPARATING PUBLIC FROM PRIVATE ────────────────────────────────────
--   Until now every active pool option appeared in both places: the admin's
--   "open an official pool" form AND the user's "start a private pool" form.
--   That is wrong, because the two are not the same product. An official pool
--   is open to everyone at the product's own minimum; a private one is a few
--   people filling a vehicle between them at a much higher slice.
--
--   Each option now says which it is for. An option built for public pools
--   simply does not appear when a user goes to start a private one.
--
-- ── 2. A PRIVATE MINIMUM PER OPTION ──────────────────────────────────────
--   One global ₦500,000 floor cannot be right for both a keke and a bus.
--   private_min_contribution sets it per option; left null, the global floor
--   still applies, so nothing changes for options that do not set one.
--
-- ── 3. WHAT THE MONEY BUYS ───────────────────────────────────────────────
--   Asset value, VAT, service charge, maintenance and the company's charge.
--   Investors are being asked for a sum; they should be able to see what it
--   is made of.
--
--   THESE MUST ADD UP TO target_amount. A breakdown that does not reconcile
--   with the figure actually being raised is worse than no breakdown, so the
--   constraint below enforces it rather than trusting the form. The columns
--   are nullable as a set: an option either itemises fully or not at all.
--
-- ⚠ RUN ORDER: after migrate-pin-and-transfer-fee.sql, whose version of
--   join_pool_from_balance this reproduces.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pool_products
  add column if not exists availability             text not null default 'both',
  add column if not exists private_min_contribution numeric(14,2),
  add column if not exists asset_value              numeric(14,2),
  add column if not exists vat                      numeric(14,2),
  add column if not exists service_charge           numeric(14,2),
  add column if not exists maintenance_fee          numeric(14,2),
  add column if not exists company_charge           numeric(14,2);

alter table public.pool_products
  drop constraint if exists pool_products_availability_check;
alter table public.pool_products
  add constraint pool_products_availability_check
  check (availability in ('public', 'private', 'both'));

comment on column public.pool_products.availability is
  'public  — only an admin may open a pool from this option. '
  'private — only a user starting their own private pool may use it. '
  'both    — available to either.';

comment on column public.pool_products.private_min_contribution is
  'Smallest slice in a PRIVATE pool built from this option. Null falls back to '
  'private_pool_minimum(). Ignored for public pools, which use min_contribution.';

-- The itemisation is all-or-nothing, and when present it must equal the
-- target. Checking `is null` on each column separately would allow a half-
-- filled breakdown that silently displays zeros.
alter table public.pool_products
  drop constraint if exists pool_products_breakdown_check;
alter table public.pool_products
  add constraint pool_products_breakdown_check check (
    (asset_value is null and vat is null and service_charge is null
      and maintenance_fee is null and company_charge is null)
    or (
      asset_value is not null and vat is not null and service_charge is not null
      and maintenance_fee is not null and company_charge is not null
      and asset_value >= 0 and vat >= 0 and service_charge >= 0
      and maintenance_fee >= 0 and company_charge >= 0
      and asset_value + vat + service_charge + maintenance_fee + company_charge
          = target_amount
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- The slice a given pool asks for, in one place.
--
-- Public pools use the option's own minimum. Private pools take the larger of
-- that and whatever private floor applies — per option when set, global
-- otherwise — so a private pool can never ask for less than a public one.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.pool_minimum(p_product_id uuid, p_is_private boolean)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_is_private then greatest(
      p.min_contribution,
      coalesce(p.private_min_contribution, public.private_pool_minimum())
    )
    else p.min_contribution
  end
  from public.pool_products p
  where p.id = p_product_id;
$$;

grant execute on function public.pool_minimum(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- join_pool_from_balance — now asking pool_minimum() instead of working the
-- floor out inline, so there is one definition of it.
--
-- Reproduced in full from migrate-pin-and-transfer-fee.sql; identical apart
-- from how v_minimum is computed.
-- ─────────────────────────────────────────────────────────────────────────────
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

  v_minimum := public.pool_minimum(v_pool.product_id, v_pool.is_private);

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
-- A user may only start a private pool from an option meant for one.
--
-- Enforced here as well as in the form, so the rule survives any future code
-- path that inserts a pool. Admin inserts are left alone: createOfficialPool
-- already restricts itself to public options.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.check_pool_product_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_availability text;
begin
  select availability into v_availability
  from public.pool_products where id = new.product_id;

  if v_availability is null then
    raise exception 'Pool option not found';
  end if;

  if new.is_private and v_availability = 'public' then
    raise exception 'That pool option is not available for private pools';
  end if;

  if not new.is_private and v_availability = 'private' then
    raise exception 'That pool option is only available for private pools';
  end if;

  return new;
end;
$$;

-- ⚠ THE NAME MATTERS. Triggers of the same type fire in alphabetical order,
--   and pools_force_private (migrate-private-pool-rules.sql) is what sets
--   is_private for a user-created pool. Named "check_…" this would sort before
--   "force_…" and read is_private before it had been set — judging the wrong
--   pool type. "verify_" sorts after "force_", so it sees the final value.
drop trigger if exists pools_check_availability on public.pools;
drop trigger if exists pools_verify_availability on public.pools;
create trigger pools_verify_availability
  before insert on public.pools
  for each row
  execute function public.check_pool_product_availability();


-- ████████████████████████████████████████████████████████████████████████
-- SECTION 20 — migrate-investment-refunds.sql
-- ████████████████████████████████████████████████████████████████████████

-- ═══════════════════════════════════════════════════════════════════════════
-- REFUNDING ONE PERSON OUT OF A POOL
--
-- Somebody asks support to leave a pool that is still filling. This takes
-- their contribution out and puts it back on their Rydvest balance, while
-- everyone else's money stays exactly where it is.
--
-- ── WHY THIS DID NOT EXIST ───────────────────────────────────────────────
-- The schema has a refunded state and markInvestmentRefunded() to reach it,
-- but that function only accepts rows already sitting at 'refund_pending' —
-- a state ONLY the old card-payment path ever produced, for a pool that
-- filled while a charge was still in flight. Balance-funded investments go
-- straight to 'paid', so nothing could ever reach the refund path. There was
-- no way to give anybody their money back short of editing the database.
--
-- ── HOW THE MONEY ACTUALLY MOVES ─────────────────────────────────────────
-- available_balance() subtracts investments whose status is 'paid' or
-- 'refund_pending'. Marking one 'refunded' drops it out of that subtraction,
-- and the money is spendable again. That is the whole mechanism.
--
-- ⚠ SO DO NOT ALSO CREDIT ANYTHING. The transactions row written below is for
--   the user's statement only — available_balance() never reads that table.
--   Adding a deposit or a positive balance row here would pay them twice.
--
-- ── WHAT IT REFUSES ──────────────────────────────────────────────────────
-- Only pools still 'open'. Once a pool is funded and running, the vehicle is
-- bought, the driver is out working and a payout schedule exists for every
-- investor — pulling one person out would mean unwinding payouts that may
-- already have been paid. That is a different, much larger operation and this
-- function will not pretend to do it.
--
-- ⚠ RUN ORDER: after migrate-pin-and-transfer-fee.sql.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.refund_investment(
  p_investment_id uuid,
  p_admin_id      uuid,
  p_reason        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv     public.investments%rowtype;
  v_pool    public.pools%rowtype;
  v_ref     text;
begin
  if p_admin_id is null or not exists (
    select 1 from public.profiles where id = p_admin_id and role = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select * into v_inv from public.investments where id = p_investment_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'investment_not_found');
  end if;

  if v_inv.status <> 'paid' then
    -- Already refunded, or never actually paid. Either way there is nothing
    -- to give back, and repeating it would hand the money over twice.
    return jsonb_build_object('ok', false, 'reason', 'not_refundable');
  end if;

  -- Lock the pool before touching either side: the amount coming out has to
  -- be subtracted from amount_raised, and a join landing at the same instant
  -- must not overwrite that.
  select * into v_pool from public.pools where id = v_inv.pool_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'pool_not_found');
  end if;

  if v_pool.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'pool_not_open');
  end if;

  perform 1 from public.profiles where id = v_inv.user_id for update;

  update public.investments
  set status = 'refunded'
  where id = p_investment_id;

  -- The pool is genuinely less full now. Without this the bar would overstate
  -- the money in it, and the pool could "fill" on contributions that are no
  -- longer there.
  update public.pools
  set amount_raised = greatest(amount_raised - v_inv.amount, 0)
  where id = v_pool.id
  returning * into v_pool;

  -- Statement line only. The balance has already moved by virtue of the
  -- status change above — see the warning at the top of this file.
  v_ref := 'RYDV-RFN-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.transactions (user_id, type, amount, reference, status, metadata)
  values (
    v_inv.user_id, 'refund', v_inv.amount, v_ref, 'success',
    jsonb_build_object(
      'investment_id', p_investment_id,
      'pool_id', v_pool.id,
      'refunded_by', p_admin_id,
      'reason', left(coalesce(p_reason, ''), 500)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'amount', v_inv.amount,
    'user_id', v_inv.user_id,
    'pool_id', v_pool.id,
    'pool_raised_after', v_pool.amount_raised,
    'reference', v_ref
  );
end;
$$;

-- Admin-only, and it checks that itself rather than trusting the caller:
-- SECURITY DEFINER means this runs with full rights whoever invokes it.
revoke all on function public.refund_investment(uuid, uuid, text) from public;
grant execute on function public.refund_investment(uuid, uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- AFTER A REFUND
--
-- The money is on the user's balance: they can withdraw it, or put it into a
-- different pool. Nothing is sent to their bank automatically — that is a
-- withdrawal, and withdrawals are their decision, not ours.
--
-- If the refund empties the pool, amount_raised returns to 0 and the pool
-- becomes cancellable again, which is the correct end state for a pool
-- nobody is left in.
-- ═══════════════════════════════════════════════════════════════════════════
