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
