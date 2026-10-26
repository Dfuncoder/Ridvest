-- ═══════════════════════════════════════════════════════════════════════════
-- WHO VERIFIES A NIN — a setting, not a redeploy
--
-- The NIN lookup was wired to Monnify alone. When Monnify stops answering —
-- an empty VAS wallet, an expired key, an outage — every verification fails
-- and there is nothing an admin can do about it but wait, because the only
-- way to point at another provider was to edit code and deploy.
--
-- Korapay answers the same question through its own identity endpoint, so the
-- choice now lives here and is read on every lookup.
--
--   nin_provider = 'monnify' | 'korapay'
--
-- Seeded to 'korapay'. Change it at /admin/settings.
--
-- Nothing else moves: both providers are sent the number and nothing else,
-- and the name comparison stays ours. Facial matching is offered by both and
-- used by neither — it would mean posting a customer's face to a payment
-- processor, and the admin already compares the selfie to the record by eye.
--
-- No function reads this value; the app does, through getNinProvider(). It is
-- here so it survives a deploy and so the admin screen has something to
-- write to. app_settings has no write policy, so only the service role —
-- behind requireAdmin() — can change it.
--
-- Safe to re-run. Will NOT overwrite a choice already made.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.app_settings (key, value)
values ('nin_provider', 'korapay')
on conflict (key) do nothing;
