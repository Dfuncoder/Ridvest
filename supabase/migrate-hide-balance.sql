-- ═══════════════════════════════════════════════════════════════════════════
-- HIDE BALANCE — a saved preference, not a per-browser one.
--
-- Both the user dashboard and the admin overview can blank their money
-- figures. Storing the choice on the profile means it is read on the server
-- with everything else, so the page renders already masked — there is no
-- moment where the real figures are painted and then hidden — and it follows
-- the account to any device.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists hide_balance boolean not null default false;

-- Column-level grants are the lockdown on this table (see supabase/schema.sql):
-- the row policy lets a user update their own row, but only the columns named
-- here. Re-granted in full because GRANT on a column list replaces nothing —
-- it adds — and listing them together keeps the allowed set in one place.
grant update (full_name, phone, address, state_of_residence, hide_balance)
  on public.profiles to authenticated;
