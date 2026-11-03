-- ═══════════════════════════════════════════════════════════════════════════
-- BROADCASTS — one composed message, many individual emails
--
-- An admin writes a subject and a few paragraphs, picks who gets it, and the
-- platform sends each person their own email in the Rydvest template.
--
-- ── WHY TWO TABLES ───────────────────────────────────────────────────────
-- The obvious shape is one row per broadcast with a "sent" counter, and it is
-- wrong the first time a send is interrupted — a serverless function has a
-- time limit, a mail provider has a rate limit, and between them a send to a
-- few hundred people cannot reliably finish inside one request. A counter
-- tells you 140 of 300 went out; it cannot tell you WHICH 140, so resuming
-- means either emailing some people twice or guessing.
--
-- So every recipient gets a row, and that row is the record of whether their
-- copy was sent. Sending claims pending rows, marks each one as it goes, and
-- can stop at any point: what is left is exactly what has not been sent.
--
-- ── WHY RECIPIENTS ARE FROZEN AT COMPOSE TIME ────────────────────────────
-- The rows are written when the broadcast is created, not resolved again at
-- send time. Somebody signing up halfway through a send should not receive a
-- message aimed at people who were already here, and somebody who opts out
-- mid-send should not get the rest of it either.
--
-- ── OPTING OUT ───────────────────────────────────────────────────────────
-- profiles.marketing_opt_out is honoured when "everyone" is chosen. It is
-- deliberately NOT honoured for a hand-picked list: an admin emailing four
-- named people about their own pool is answering them, not marketing at them.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE OPT-OUT FLAG
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists marketing_opt_out boolean not null default false;

comment on column public.profiles.marketing_opt_out is
  'Set from the unsubscribe link in a broadcast. Excludes this profile from '
  '"everyone" sends. Never excludes transactional mail — receipts, codes and '
  'security notices are not optional.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. THE BROADCAST
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (length(btrim(subject)) between 3 and 150),
  heading     text not null check (length(btrim(heading)) between 3 and 120),
  body        text not null check (length(btrim(body)) between 10 and 8000),
  cta_label   text,
  cta_url     text,
  -- 'support' or 'noreply'. Stored as written rather than as the resolved
  -- address, so changing CONTACT_EMAIL later does not rewrite history.
  from_role   text not null default 'support' check (from_role in ('support', 'noreply')),
  audience    text not null check (audience in ('all', 'selected')),
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);

alter table public.broadcasts enable row level security;

-- Admins only, and read only. Every write goes through a server action using
-- the service role: nobody sends mail to the whole customer base through the
-- REST API.
drop policy if exists "broadcasts: admin reads" on public.broadcasts;
create policy "broadcasts: admin reads" on public.broadcasts
  for select to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ONE ROW PER PERSON
--
-- The email is copied onto the row rather than joined at send time: it is the
-- address the message actually went to, and a profile edited next month must
-- not rewrite what happened today.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcast_recipients (
  id           bigint generated always as identity primary key,
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  email        text not null,
  full_name    text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error        text,
  sent_at      timestamptz,
  -- One copy per person per broadcast. This constraint is what makes a
  -- resumed send safe: a duplicate insert cannot create a second copy.
  constraint broadcast_recipients_once unique (broadcast_id, user_id)
);

create index if not exists broadcast_recipients_pending_idx
  on public.broadcast_recipients (broadcast_id, status);

alter table public.broadcast_recipients enable row level security;

drop policy if exists "broadcast_recipients: admin reads" on public.broadcast_recipients;
create policy "broadcast_recipients: admin reads" on public.broadcast_recipients
  for select to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PROGRESS, WITHOUT COUNTING ROWS IN THE APP
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.broadcast_progress(p_broadcast_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'total',   count(*),
    'sent',    count(*) filter (where status = 'sent'),
    'failed',  count(*) filter (where status = 'failed'),
    'pending', count(*) filter (where status = 'pending')
  )
  from public.broadcast_recipients
  where broadcast_id = p_broadcast_id;
$$;

revoke all on function public.broadcast_progress(uuid) from public, anon;
grant execute on function public.broadcast_progress(uuid) to authenticated, service_role;
