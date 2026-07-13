-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION: pool duration from MONTHS → WEEKS (payouts become weekly)
--
-- Run this ONCE in the Supabase SQL editor if your database was created with
-- the older schema that had pool_products.duration_months.
-- (Fresh installs of supabase/schema.sql don't need this file.)
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Rename the column and widen its range (weeks go up to 520 ≈ 10 years).
alter table public.pool_products rename column duration_months to duration_weeks;
alter table public.pool_products drop constraint if exists pool_products_duration_months_check;
alter table public.pool_products drop constraint if exists pool_products_duration_weeks_check;
alter table public.pool_products add constraint pool_products_duration_weeks_check
  check (duration_weeks between 1 and 520);

-- ⚠ If you already created products while durations meant MONTHS, convert
-- their values (uncomment):
-- update public.pool_products set duration_weeks = duration_weeks * 4;

-- 2. Replace the payment-confirmation function with the weekly version.
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
