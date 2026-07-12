# Rydvest

**Invest. Ride. Earn.** — a pooled vehicle-investment platform for everyday earners in Nigeria.

Users pool money together to fund income-generating vehicles (e.g. Keke Napep). When a pool is
fully funded it starts running, and every investor receives monthly payouts at a fixed ROI until
the pool's duration ends. Investors can withdraw earnings to a bank account that matches their
verified name.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Actions, Proxy) + React 19 |
| Styling | Tailwind CSS 4 |
| Database & Auth | [Supabase](https://supabase.com) (Postgres + Row Level Security, email OTP auth, modern publishable/secret API keys) |
| Payments | [Paystack](https://paystack.com) (hosted checkout + signature-verified webhooks) |
| Validation | Zod (server-side, on every input) |
| Hosting | [Vercel](https://vercel.com) |

## Features

**For investors**
- Signup with email OTP verification (name, DOB 18+, phone, address & state of residence)
- Browse open pools, invest via Paystack, watch live fill progress
- Create private pools and invite friends with an 8-character code
- Dashboard: balance, total invested/earned, payout schedule, portfolio
- Withdrawals to a bank account whose name **must match** the profile name
- Functional forgot/reset-password flow

**For admins** (`/admin`)
- Business overview: total invested vs. promised vs. paid out, projected margin
- Create pool options (asset name, pool price, min contribution, duration, ROI %)
- Open/cancel pools, reconcile investments by Paystack reference
- Mark payouts paid, review withdrawals (with name-match indicator), reset user access
- Every admin action recorded in an audit log

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up Supabase + Paystack** — follow [SETUP.md](SETUP.md) step by step
   (creates the project, runs [supabase/schema.sql](supabase/schema.sql), installs the
   branded email templates from [supabase/email-templates/](supabase/email-templates/),
   configures the Paystack webhook).

3. **Configure environment**

   ```bash
   cp .env.example .env.local   # then fill in every value
   ```

4. **Run**

   ```bash
   npm run dev                  # http://localhost:3000
   ```

5. **Create your admin** — register normally, then in the Supabase SQL editor:

   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
   ```

## Project structure

```
app/
  actions/            Server actions (auth, invest, account, admin)
  admin/              Admin dashboard (role-gated server-side)
  dashboard/          User dashboard (auth-gated server-side)
  api/
    interest-rate/    Public headline-rate endpoint (reads app_settings)
    webhooks/paystack Webhook — the ONLY place money is credited
  auth/confirm/       Email-link handler (password reset)
  login|register|verify-otp|forgot-password|reset-password/
components/
  auth/               Shared auth UI (logo, inputs, banners)
  dashboard/          User dashboard shell + client forms
  admin/              Admin shell + product form
lib/
  errors.ts           ★ ALL user-facing error messages (edit copy here)
  validation.ts       Zod schemas (password rules, NG phone, 18+, states)
  supabase/           Server client (RLS) + admin client (secret key)
  auth.ts             requireUser / requireAdmin guards
  paystack.ts         Initialize/verify/HMAC helpers (server-only)
supabase/
  schema.sql          Full DB schema, RLS policies, atomic money functions
  email-templates/    Branded Supabase auth emails (confirm signup, reset password)
proxy.ts              Route protection + session refresh (Next 16 proxy)
SETUP.md              Full step-by-step setup & deployment guide
```

## Security model

- **RLS everywhere, deny by default** — users can read only their own rows and cannot write
  to any financial table; all money writes go through validated server actions using the
  secret key.
- **Atomic money functions in SQL** — payment confirmation, pool filling, and withdrawal
  requests run inside Postgres functions with row locks, so races can't overfill a pool or
  double-credit a payment. Webhook processing is idempotent.
- **Paystack defense in depth** — HMAC-SHA512 signature check, independent verify API call,
  and a kobo-exact amount check before anything is credited. The browser redirect after
  payment is never trusted.
- **No self-promotion** — the `role` column is not writable by users (column-level grants);
  admin checks happen server-side on every request.
- **Secrets stay on the server** — enforced by the `server-only` package; security headers
  set in [next.config.ts](next.config.ts).

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add the five environment variables from [.env.example](.env.example)
   (set `NEXT_PUBLIC_SITE_URL` to the deployed URL, no trailing slash).
3. Point the Paystack webhook at `https://YOUR-DOMAIN/api/webhooks/paystack` and set the
   Supabase Site URL / redirect URLs to the deployed domain.
4. Deploy. Run through the first-run checklist at the bottom of [SETUP.md](SETUP.md).
