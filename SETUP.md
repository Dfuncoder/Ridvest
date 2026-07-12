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

This creates every table, all Row Level Security policies, and the atomic
money functions.

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

## 2. Create the Paystack account / keys

1. <https://dashboard.paystack.com> → **Settings → API Keys & Webhooks**.
2. Copy the **Secret key** (`sk_test_...` while testing) → `PAYSTACK_SECRET_KEY`.
3. Set the **Webhook URL** to:
   - Production: `https://YOUR-DOMAIN/api/webhooks/paystack`
   - Local testing: Paystack can't reach `localhost` — the payment callback
     page also confirms payments, so local test payments still work; the
     webhook is the belt-and-braces path for production.
4. When you go live, swap to the `sk_live_...` key and set the live webhook URL.

---

## 3. Environment variables

```bash
# copy the template, then fill in every value
cp .env.example .env.local
```

On **Vercel**: Project → Settings → Environment Variables → add the same five
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
- [ ] `/dashboard/invest` → invest with a
      [Paystack test card](https://paystack.com/docs/payments/test-payments)
      (e.g. `4084 0840 8408 4081`, any future expiry, CVV `408`)
- [ ] Payment confirms → pool progress moves
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
| Paystack webhook (credits money) | [`app/api/webhooks/paystack/route.ts`](app/api/webhooks/paystack/route.ts) |
| Route protection (proxy) | [`proxy.ts`](proxy.ts) |
| Security headers | [`next.config.ts`](next.config.ts) |

## Security model in one paragraph

Users authenticate through Supabase Auth (sessions in httpOnly cookies).
Every table has Row Level Security: users can read only their own rows and
cannot write to any financial table at all — all money writes go through
server actions that verify the session first, and the payment/pool/withdrawal
state machines live in atomic SQL functions that re-check every invariant
(amount to the kobo, pool capacity, name match, balance) inside the database.
Money is only ever credited by the Paystack webhook/callback after an HMAC
signature check **and** an independent verify call to Paystack. Secrets never
reach the browser (`server-only` guards), admins are checked server-side on
every request, users cannot promote themselves (the `role` column is not
writable by users), and every admin action is written to `audit_log`.
