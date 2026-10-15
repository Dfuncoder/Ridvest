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
