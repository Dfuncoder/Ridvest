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
