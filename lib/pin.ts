import { ERRORS, DYNAMIC_ERRORS, DB_REASON_TO_ERROR } from "./errors";

/**
 * Turns a PIN failure from SQL into a message for the right form field.
 *
 * Shared by withdrawals, pool joins and transfers so all three say the same
 * thing — and so "two tries left" is never silently dropped in one of them.
 * Returns null when the reason was not about the PIN at all.
 */
export function pinFieldError(result: {
  reason?: string;
  attempts_left?: number;
} | null): string | null {
  switch (result?.reason) {
    case "pin_not_set":
      return ERRORS.PIN_NOT_SET;
    case "pin_locked":
      return ERRORS.PIN_LOCKED;
    case "pin_wrong": {
      const left = Number(result.attempts_left ?? 0);
      // Counting down is the warning. Without it the lockout arrives with no
      // notice and looks like the account broke.
      return left > 0 ? DYNAMIC_ERRORS.PIN_ATTEMPTS_LEFT(left) : ERRORS.PIN_WRONG;
    }
    case "pin_invalid":
      return ERRORS.PIN_INVALID;
    default:
      return null;
  }
}

/** True when this reason is a PIN problem rather than anything else. */
export function isPinReason(reason: string | undefined): boolean {
  return Boolean(reason && reason in PIN_REASONS);
}

const PIN_REASONS = {
  pin_not_set: 1,
  pin_locked: 1,
  pin_wrong: 1,
  pin_invalid: 1,
} as const;

// Re-exported so callers need one import, not three.
export { DB_REASON_TO_ERROR };
