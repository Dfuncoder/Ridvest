-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCT VISIBILITY — a user can always read the product behind their own
-- money.
--
-- The old policy was:
--
--   using (active or public.is_admin())
--
-- so the moment an admin deactivated a pool option, every investor in a pool
-- built on it lost the ability to read it. The dashboard embeds the product
-- alongside each investment, PostgREST returned product: null, and the page
-- crashed reading roi_percent off null.
--
-- Deactivating a product is meant to stop NEW pools using it, not to hide an
-- investment someone already holds. This widens the read to cover products the
-- caller has money in, or has a pool of their own built on.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.has_stake_in_product(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    -- An investment in any pool built on this product.
    select 1
    from public.investments i
    join public.pools p on p.id = i.pool_id
    where i.user_id = auth.uid()
      and p.product_id = p_product_id
  )
  or exists (
    -- Or a pool of their own built on it, even before anyone has funded it.
    select 1 from public.pools
    where product_id = p_product_id
      and created_by = auth.uid()
  );
$$;

grant execute on function public.has_stake_in_product(uuid) to authenticated;

drop policy if exists "products: read active or admin" on public.pool_products;
drop policy if exists "products: read active, own stake, or admin" on public.pool_products;

create policy "products: read active, own stake, or admin" on public.pool_products
  for select to authenticated
  using (active or public.is_admin() or public.has_stake_in_product(id));
