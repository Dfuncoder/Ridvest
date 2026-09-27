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
