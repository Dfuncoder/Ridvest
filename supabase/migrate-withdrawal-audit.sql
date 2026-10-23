-- ═══════════════════════════════════════════════════════════════════════════
-- WITHDRAWAL AUDIT — who approved it, who paid it.
--
-- A withdrawal recorded only that it had been processed, never by whom. For
-- money leaving the platform to a bank account, "which admin did this and
-- when" is the first question anyone asks when something is disputed, and the
-- audit_log alone makes you join by hand.
--
-- Two actors are recorded because they are often different people: one admin
-- approves, another sends the transfer and marks it paid.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.withdrawals
  add column if not exists approved_by uuid references public.profiles (id);

alter table public.withdrawals
  add column if not exists approved_at timestamptz;

alter table public.withdrawals
  add column if not exists processed_by uuid references public.profiles (id);

-- Writes go through server actions using the service role, so no grants change.
