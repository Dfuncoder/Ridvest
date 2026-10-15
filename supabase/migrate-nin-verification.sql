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

-- The user may read the outcome of their own check, but not the raw names
-- returned for somebody else's — the row policy already limits that, and the
-- column grant keeps the API surface to what the dashboard actually shows.
revoke select on public.kyc_submissions from authenticated;
grant select (
  id, user_id, id_type, id_number_last4, selfie_path,
  status, admin_note, reviewed_by, reviewed_at, created_at,
  lookup_status, lookup_at
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
