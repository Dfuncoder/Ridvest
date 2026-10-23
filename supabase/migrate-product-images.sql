-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT IMAGES — so a keke pool does not look like a minibus pool.
--
-- One nullable column. When it is null the app falls back to matching the
-- product name against its catalogue (lib/vehicles.ts), so every pool option
-- that already exists gets the right picture without an admin touching it.
-- Setting the column overrides that guess.
--
-- The value is a path under /public, not a URL, so the images stay bundled and
-- served by Next's optimiser. Nothing here is user-supplied: the admin form
-- offers a fixed list.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pool_products
  add column if not exists image_path text;

comment on column public.pool_products.image_path is
  'Path under /public for the vehicle photo, e.g. /header_image.png. '
  'Null means: work it out from the product name (lib/vehicles.ts).';

-- No grant needed: pool_products is granted at table level, which covers
-- columns added later, and the existing "products: read active or admin"
-- policy still decides which rows anyone sees.
