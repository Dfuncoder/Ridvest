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
