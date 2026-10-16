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
