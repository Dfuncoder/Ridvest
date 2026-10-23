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

/**
 * Flat charge on an internal transfer, paid by the sender on top of the
 * amount sent. The recipient receives the full amount.
 *
 * ⚠ Mirrored by transfer_fee() in supabase/migrate-pin-and-transfer-fee.sql,
 *   which is what actually charges it. Change both together.
 */
export const TRANSFER_FEE = 50;

/** What leaves the sender's balance for a transfer of `amount`. */
export function transferTotal(amount: number): number {
  return amount + TRANSFER_FEE;
}

/**
 * The cost breakdown behind a pool option — what the money actually buys.
 *
 * The five components must add up to the total package, which IS the pool's
 * target_amount. A breakdown that does not reconcile with the figure being
 * raised is worse than no breakdown, so the database enforces it too
 * (pool_products_breakdown_check).
 */
export type AssetBreakdown = {
  assetValue: number;
  vat: number;
  serviceCharge: number;
  maintenanceFee: number;
  companyCharge: number;
};

export function totalPackage(b: AssetBreakdown): number {
  return b.assetValue + b.vat + b.serviceCharge + b.maintenanceFee + b.companyCharge;
}

/**
 * What an investor is shown.
 *
 * ROI applies to the TOTAL PACKAGE, not to the asset value alone — the total
 * is what they put in, so it is what the return has to be measured against.
 */
export function assetReturns(totalAmount: number, roiPercent: number) {
  const profit = Math.round(totalAmount * (roiPercent / 100) * 100) / 100;
  return { profit, totalPayout: totalAmount + profit };
}
