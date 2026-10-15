/**
 * Rydvest's cut.
 *
 * Every pool that reaches its target earns the platform 10% of what was raised
 * — the arrangement fee for sourcing the vehicle, vetting the driver and
 * running the operation. Pools still filling are excluded: nothing is owed
 * until a pool is funded and the vehicle goes out.
 *
 * Kept here rather than inlined so the figure has one home if it changes, or
 * moves into app_settings later.
 */

export const PLATFORM_FEE_RATE = 0.1;

export function platformFee(fundedAmount: number): number {
  return Math.round(fundedAmount * PLATFORM_FEE_RATE * 100) / 100;
}

export const PLATFORM_FEE_LABEL = `${Math.round(PLATFORM_FEE_RATE * 100)}%`;

/**
 * The floor on a single contribution into a PRIVATE pool.
 *
 * Private pools are a handful of people filling a vehicle between them, so the
 * slices are bigger; public pools keep the product's own minimum, which is what
 * makes them the way in for smaller investors.
 *
 * ⚠ Mirrored by private_pool_minimum() in supabase/migrate-private-pool-rules.sql,
 *   which is what actually enforces it. Change both together.
 */
export const PRIVATE_POOL_MINIMUM = 500_000;

/**
 * What a given pool asks for per contribution. The product minimum always
 * applies; a private pool additionally cannot go below PRIVATE_POOL_MINIMUM.
 */
export function poolMinimum(minContribution: number, isPrivate: boolean): number {
  return isPrivate ? Math.max(minContribution, PRIVATE_POOL_MINIMUM) : minContribution;
}

/**
 * Limits on sending balance to another Rydvest account.
 *
 * ⚠ Mirrored by transfer_limits() in supabase/migrate-internal-transfers.sql,
 *   which is what actually binds — these copies only drive the form's hints so
 *   the user is told the rule before they hit it. Change both together.
 */
export const TRANSFER_LIMITS = {
  minAmount: 100,
  maxAmount: 2_000_000,
  maxPerDay: 5_000_000,
  maxPerHour: 10,
} as const;
