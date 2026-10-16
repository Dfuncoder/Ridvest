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
