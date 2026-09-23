# Rydvest — Backend Setup Guide

Follow these steps in order. Total time: ~20 minutes..

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick any name (e.g. `rydvest`), a strong database password (save it), and a
   region close to Nigeria (e.g. **West EU (London)** or **Central EU**).
3. Wait for the project to finish provisioning.

### 1a. Get your API keys (the NEW key system — not the legacy ones)

Go to **Project Settings → API Keys**:

| Key | Looks like | Goes into `.env.local` as |
|---|---|---|
| Project URL | `https://xxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `sb_publishable_...` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key | `sb_secret_...` (click **Create new secret key** if none exists) | `SUPABASE_SECRET_KEY` |

> Do **not** use the "legacy" `anon` / `service_role` JWT keys — the code is
> built for the modern publishable/secret keys, and Supabase's JWT **signing
> keys** (Project Settings → JWT Keys → migrate if prompted) let the app verify
> sessions locally without extra network calls.

### 1b. Run the database schema

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Click **Run**. You should see "Success. No rows returned".
4. New query again, and run
   [`supabase/migrate-monnify-to-korapay.sql`](supabase/migrate-monnify-to-korapay.sql).
   This is what adds the wallet: the `deposits` table, the balance that spends
   as well as earns, and `join_pool_from_balance()`. **The app does not work
   without it.**

Together these create every table, all Row Level Security policies, and the
atomic money functions.

> **Already have a live database?** Don't re-run `schema.sql`. Run only
> [`supabase/migrate-monnify-to-korapay.sql`](supabase/migrate-monnify-to-korapay.sql).
> It supersedes `migrate-months-to-weeks.sql` and
> `migrate-paystack-to-monnify.sql` — it renames those columns itself if they
> are still outstanding, so it works whichever of the older migrations you did
> or didn't run, and is safe to re-run. It then adds the `deposits` table,
> teaches `available_balance()` to spend as well as earn, and adds
> `join_pool_from_balance()`. Investments paid through the old gateway are
> tagged `funding = 'gateway'` and are left out of the balance, so existing
> books stay correct.
>
> ⚠ If your database still had `duration_months`, the rename keeps the
> **number**: a product that meant 12 months now reads 12 weeks. Check
> `pool_products` afterwards and multiply by 4 if you have real products
> priced in months — there is a commented-out `update` at the top of the
> migration for exactly this.

### 1c. Configure auth emails (6-digit OTP for signup)

1. Dashboard → **Authentication → Sign In / Providers → Email**: make sure
   **"Confirm email"** is ON (it is by default).
2. Dashboard → **Authentication → Emails → Templates → Confirm signup**:
   replace the entire template body with the branded template in
   [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html)
   (navy/amber Rydvest design, renders in Gmail/Outlook/Apple Mail).
   Suggested subject line: `Your Rydvest verification code`.

   The important part is **`{{ .Token }}`** — that's the 6-digit code the
   /verify-otp page expects (instead of a confirmation link).
3. Dashboard → **Authentication → Emails → Templates → Reset Password**:
   replace the entire template body with the branded template in
   [`supabase/email-templates/reset-password.html`](supabase/email-templates/reset-password.html).
   Suggested subject line: `Reset your Rydvest password`.
   (This is the email the forgot-password flow sends; its button links to
   `/auth/confirm` → `/reset-password`. Keep the `token_hash` URL exactly as
   written in the template — don't swap it for `{{ .ConfirmationURL }}`.)
4. Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://rydvest.vercel.app`)
   - **Redirect URLs**: add `http://localhost:3000/**` and
     `https://YOUR-DOMAIN/**`

> 📧 **Production note:** Supabase's built-in email sender is rate-limited
> (fine for testing). Before launch, plug in your own SMTP provider under
> **Authentication → Emails → SMTP Settings** (e.g. Resend, Postmark, SES).

---

## 2. Choose how users pay

The app ships set to **manual bank transfer**, which needs no payment provider
at all. You can switch to Korapay later at `/admin/settings` without touching code.

### Option A — manual bank transfer (default)

1. Log in as an admin and open **/admin/settings**.
2. Set the account number, account name and bank users should transfer to.
3. List the emails that should be told when someone declares a transfer
   (comma-separated). Everyone on that list gets a link to confirm it.

Nothing is credited until someone opens that link and presses **Money
received**, so keep the list to people who can actually see the bank account.
Email delivery needs `RESEND_API_KEY` (see step 3) — without it the transfer
still appears at **/admin/deposits**, you just won't be emailed about it.

### Option B — Korapay

1. Sign up at <https://korapay.com> → **Settings → API Keys**.
2. Copy the **secret key** (`sk_test_...` in test mode, `sk_live_...` live) into
   `KORAPAY_SECRET_KEY`. The same key signs webhooks, so a wrong value here
   means every webhook is rejected and no top-up is ever credited.
3. Set the webhook URL to `https://YOUR-DOMAIN/api/webhooks/korapay`.
   Korapay can't reach `localhost` — the callback page also confirms top-ups,
   so local test payments still work; the webhook is the production path.
4. Switch the method to **Korapay** at **/admin/settings**.

---

## 3. Environment variables

```bash
# copy the template, then fill in every value
cp .env.example .env.local
```

On **Vercel**: Project → Settings → Environment Variables → add the same
variables (set `NEXT_PUBLIC_SITE_URL` to your real deployed URL, no trailing
slash), then redeploy.

---

## 4. Create your admin account

1. Run the app (`npm run dev`), register normally at `/register`, and verify
   the email OTP.
2. In Supabase → **SQL Editor**, run:

   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```

3. Log out and back in — you'll be routed to `/admin`.

---

## 5. First-run checklist

- [ ] `/register` → receive OTP email → verify → land on `/dashboard`
- [ ] `/admin/products` → create a pool option (e.g. Keke Napep, ₦2,500,000,
      min ₦50,000, 12 months, 50% ROI)
- [ ] `/admin/pools` → open an official pool
- [ ] `/dashboard/wallet` → fund the account (bank transfer, or a Korapay test
      card if you switched the method)
- [ ] Manual method: the transfer shows as **Processing**, the notification
      email arrives, and pressing **Money received** credits the balance
- [ ] `/dashboard/invest` → join a pool from that balance → pool progress moves
- [ ] Fill a small test pool completely → pool flips to **active**, payout
      schedule appears under `/dashboard/payouts` and `/admin/payouts`
- [ ] `/dashboard/profile` → add a bank account (name must match profile)
- [ ] `/admin/payouts` → mark a payout paid → user balance rises →
      `/dashboard/payouts` → request withdrawal → approve/pay in
      `/admin/withdrawals`

---

## Where things live (for future edits)

| What | File |
|---|---|
| **All user-facing error messages** | [`lib/errors.ts`](lib/errors.ts) — edit copy here |
| Validation rules (password, phone, 18+ check, states) | [`lib/validation.ts`](lib/validation.ts) |
| Database schema, RLS, money functions | [`supabase/schema.sql`](supabase/schema.sql) |
| Auth flows (signup/OTP/login/reset) | [`app/actions/auth.ts`](app/actions/auth.ts) |
| Investing & pools | [`app/actions/invest.ts`](app/actions/invest.ts) |
| Profile / bank accounts / withdrawals | [`app/actions/account.ts`](app/actions/account.ts) |
| Admin operations | [`app/actions/admin.ts`](app/actions/admin.ts) |
| Funding the balance | [`app/actions/wallet.ts`](app/actions/wallet.ts) |
| Korapay webhook (credits top-ups) | [`app/api/webhooks/korapay/route.ts`](app/api/webhooks/korapay/route.ts) |
| Payment method + bank details | [`lib/settings.ts`](lib/settings.ts) |
| Route protection (proxy) | [`proxy.ts`](proxy.ts) |
| Security headers | [`next.config.ts`](next.config.ts) |

## Security model in one paragraph

Users authenticate through Supabase Auth (sessions in httpOnly cookies).
Every table has Row Level Security: users can read only their own rows and
cannot write to any financial table at all — all money writes go through
server actions that verify the session first, and the payment/pool/withdrawal
state machines live in atomic SQL functions that re-check every invariant
(amount to the kobo, pool capacity, name match, balance) inside the database.
A Korapay top-up is only ever credited by the webhook/callback after an HMAC
signature check **and** an independent verify call to Korapay; a manual
transfer is only ever credited by a signed-in admin pressing the confirm
button behind a single-use link. Secrets never
reach the browser (`server-only` guards), admins are checked server-side on
every request, users cannot promote themselves (the `role` column is not
writable by users), and every admin action is written to `audit_log`.
