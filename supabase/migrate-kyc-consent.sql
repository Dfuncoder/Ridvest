-- ═══════════════════════════════════════════════════════════════════════════
-- RECORDING CONSENT
--
-- A NIN lookup asks a government database about a named person. Every provider
-- requires the subject to have agreed to it, and one refuses the call outright
-- without the flag — so the agreement has to be real, and it has to be on
-- record.
--
-- The form now asks explicitly, the submit action refuses without it, and this
-- column holds the moment it was given. A consent record with no timestamp is
-- hard to stand behind months later, when somebody asks who authorised what
-- and when.
--
-- Nullable because rows submitted before this existed genuinely have no
-- answer, and inventing one would be worse than leaving it empty.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.kyc_submissions
  add column if not exists consented_at timestamptz;

comment on column public.kyc_submissions.consented_at is
  'When the user agreed to the NIN check, from the consent box on the '
  'verification form. Null on rows submitted before consent was captured.';
