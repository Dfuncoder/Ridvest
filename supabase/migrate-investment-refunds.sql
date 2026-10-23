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
