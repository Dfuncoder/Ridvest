-- ═══════════════════════════════════════════════════════════════════════════
-- ARTICLES — written and published from the admin console
--
-- They started life in a TypeScript file, which meant publishing a piece of
-- news required a developer and a deploy. That is the wrong shape for the
-- thing it describes: news is written by whoever has the news.
--
-- ── DRAFT AND PUBLISHED ARE DIFFERENT WORLDS ─────────────────────────────
-- A draft is invisible to the public. Not "hidden behind a link nobody has" —
-- actually invisible, because the read policy below only ever admits rows
-- with status = 'published'. A half-written article cannot leak by somebody
-- guessing a slug, which is exactly how half-written articles leak.
--
-- ── THE SLUG IS THE URL ──────────────────────────────────────────────────
-- Unique, and permanent once shared. The app offers to generate one from the
-- title, but an admin can set it, and changing it later breaks every link to
-- the piece — so the form says so rather than letting somebody find out.
--
-- ── WHY published_at IS SEPARATE FROM created_at ─────────────────────────
-- A piece drafted in March and published in May is dated May to a reader, and
-- the ordering on the index has to follow what the reader sees. Set when the
-- status first becomes 'published', and kept if it is unpublished and
-- published again — the news did not happen twice.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
               check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 90),
  title        text not null check (length(btrim(title)) between 5 and 160),
  summary      text not null check (length(btrim(summary)) between 10 and 320),
  body         text not null check (length(btrim(body)) between 50 and 40000),
  category     text not null default 'News' check (category in ('News', 'Company')),
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A published row without a date would sort unpredictably on the index and
  -- show a blank where a date belongs. The trigger below fills it, and this
  -- makes a missing one impossible rather than merely unlikely.
  constraint articles_published_has_date
    check (status <> 'published' or published_at is not null)
);

create index if not exists articles_published_idx
  on public.articles (status, published_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stamps, so nothing depends on the app remembering to set them.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.articles_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  -- First publication only. Unpublishing and publishing again keeps the
  -- original date: the news did not happen twice.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists articles_touch on public.articles;
create trigger articles_touch
  before insert or update on public.articles
  for each row execute function public.articles_touch();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
--
-- Anyone — signed in or not — may read a PUBLISHED article; that is the point
-- of a public news page. Drafts are admin-only. There is no insert, update or
-- delete policy at all: writing goes through server actions using the service
-- role, behind requireAdmin().
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.articles enable row level security;

drop policy if exists "articles: public reads published" on public.articles;
create policy "articles: public reads published" on public.articles
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists "articles: admin reads all" on public.articles;
create policy "articles: admin reads all" on public.articles
  for select to authenticated
  using (public.is_admin());

revoke all on public.articles from public;
grant select on public.articles to anon, authenticated;
