/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RYDVEST — ERROR MESSAGE CATALOG
 *
 * ★ EVERY user-facing error message in the app lives in this ONE file. ★
 *
 * Want to change any wording? Edit the string here — nothing else to touch.
 * Server actions and pages refer to these by key (e.g. ERRORS.AUTH_INVALID_LOGIN),
 * so the copy stays consistent everywhere it appears.
 *
 * SECURITY NOTE: some messages are deliberately vague (e.g. login failure
 * doesn't say whether the email exists) so attackers can't probe for accounts.
 * Keep that in mind when rewording.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const ERRORS = {
  // ── Signup / registration ─────────────────────────────────────────────────
  SIGNUP_NAME_REQUIRED: "Please enter your full name (at least 3 characters).",
  SIGNUP_EMAIL_INVALID: "Please enter a valid email address.",
  SIGNUP_PASSWORD_WEAK:
    "Password must be at least 8 characters and include a letter, a number and a special character.",
  SIGNUP_PASSWORDS_DONT_MATCH: "Passwords do not match.",
  SIGNUP_DOB_REQUIRED: "Please enter your date of birth.",
  SIGNUP_UNDERAGE: "You must be at least 18 years old to use Rydvest.",
  SIGNUP_PHONE_INVALID: "Please enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678).",
  SIGNUP_ADDRESS_REQUIRED: "Please enter your home address.",
  SIGNUP_STATE_REQUIRED: "Please select your state of residence.",
  SIGNUP_TERMS_REQUIRED: "You must agree to the Terms of Service and Privacy Policy.",
  SIGNUP_EMAIL_TAKEN: "An account with this email already exists. Try logging in instead.",
  SIGNUP_FAILED: "We couldn't create your account right now. Please try again in a moment.",

  // ── Email OTP verification ────────────────────────────────────────────────
  OTP_INVALID: "Incorrect or expired code. Please check your email and try again.",
  OTP_EMAIL_MISSING: "We couldn't tell which email to verify. Please register or log in again.",
  OTP_RESEND_FAILED: "Couldn't resend the code. Please wait a minute and try again.",

  // ── Login ─────────────────────────────────────────────────────────────────
  // Deliberately vague: never reveal whether the email exists.
  AUTH_INVALID_LOGIN: "Incorrect email or password.",
  AUTH_EMAIL_NOT_CONFIRMED: "Please verify your email first. We've sent you a new code.",
  AUTH_NOT_LOGGED_IN: "Please log in to continue.",
  AUTH_NOT_ADMIN: "You don't have permission to access that page.",
  AUTH_RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",

  // ── Forgot / reset password ───────────────────────────────────────────────
  // Same message whether or not the account exists (no account probing).
  FORGOT_PASSWORD_SENT:
    "If an account exists for that email, we've sent a password reset link. Check your inbox.",
  RESET_LINK_INVALID: "This reset link is invalid or has expired. Please request a new one.",
  RESET_PASSWORD_FAILED: "Couldn't update your password. Please request a new reset link.",

  // ── Profile & withdrawal accounts ─────────────────────────────────────────
  PROFILE_UPDATE_FAILED: "Couldn't save your profile changes. Please try again.",
  ACCOUNT_NUMBER_INVALID: "Account number must be exactly 10 digits.",
  ACCOUNT_BANK_REQUIRED: "Please enter your bank name.",
  ACCOUNT_NAME_REQUIRED: "Please enter the account holder name.",
  ACCOUNT_NAME_MISMATCH:
    "The bank account name must match the name on your profile. Withdrawals to accounts in a different name are not allowed.",
  ACCOUNT_SAVE_FAILED: "Couldn't save your bank details. Please try again.",
  ACCOUNT_DUPLICATE: "You've already added this account number.",

  // ── Investing / pools ─────────────────────────────────────────────────────
  POOL_NOT_FOUND: "That pool doesn't exist or is no longer available.",
  POOL_NOT_OPEN: "This pool is no longer accepting investments.",
  POOL_AMOUNT_TOO_SMALL: "Your investment is below the minimum contribution for this pool.",
  POOL_AMOUNT_TOO_LARGE: "That amount is more than what's left to fill this pool.",
  POOL_INVALID_AMOUNT: "Please enter a valid amount.",
  POOL_CREATE_FAILED: "Couldn't create your pool. Please try again.",
  POOL_PRODUCT_INACTIVE: "This investment option is currently unavailable.",
  POOL_INVITE_INVALID: "That invite code doesn't match any private pool.",
  PAYMENT_INIT_FAILED: "Couldn't start the payment. Please try again.",
  PAYMENT_NOT_CONFIRMED:
    "We haven't confirmed your payment yet. If you were charged, it will reflect within a few minutes.",

  // ── Withdrawals ───────────────────────────────────────────────────────────
  WITHDRAW_NO_ACCOUNT: "Add a withdrawal bank account first (Profile → Withdrawal details).",
  WITHDRAW_INVALID_AMOUNT: "Please enter a valid withdrawal amount.",
  WITHDRAW_INSUFFICIENT: "That amount is more than your available balance.",
  WITHDRAW_PENDING_EXISTS: "You already have a pending withdrawal request. Wait for it to be processed.",
  WITHDRAW_FAILED: "Couldn't submit your withdrawal request. Please try again.",

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_PRODUCT_INVALID: "Please fill in all product fields with valid values.",
  ADMIN_ACTION_FAILED: "That action failed. Please try again.",
  ADMIN_USER_NOT_FOUND: "User not found.",

  // ── Contact form ──────────────────────────────────────────────────────────
  CONTACT_NAME_REQUIRED: "Please enter your name.",
  CONTACT_EMAIL_INVALID: "Please enter a valid email so we can reply to you.",
  CONTACT_MESSAGE_REQUIRED: "Please write a message (at least 10 characters).",
  CONTACT_FAILED: "Couldn't send your message right now. Please try again in a moment.",

  // ── Generic ───────────────────────────────────────────────────────────────
  GENERIC: "Something went wrong. Please try again.",
} as const;

export type ErrorKey = keyof typeof ERRORS;

/**
 * Maps the machine-readable `reason` codes returned by the SQL functions
 * (supabase/schema.sql) to catalog messages, so DB-enforced rules surface as
 * friendly text.
 */
export const DB_REASON_TO_ERROR: Record<string, string> = {
  not_authenticated: ERRORS.AUTH_NOT_LOGGED_IN,
  invalid_amount: ERRORS.WITHDRAW_INVALID_AMOUNT,
  account_not_found: ERRORS.WITHDRAW_NO_ACCOUNT,
  name_mismatch: ERRORS.ACCOUNT_NAME_MISMATCH,
  pending_request_exists: ERRORS.WITHDRAW_PENDING_EXISTS,
  insufficient_balance: ERRORS.WITHDRAW_INSUFFICIENT,
  pool_full_refund_pending: ERRORS.POOL_AMOUNT_TOO_LARGE,
};
