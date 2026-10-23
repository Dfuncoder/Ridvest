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
