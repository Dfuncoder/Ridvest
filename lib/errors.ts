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
  LOGIN_CODE_SENT: "We've emailed you a 6-digit code. It expires in 10 minutes.",
  LOGIN_CODE_SEND_FAILED:
    "We couldn't send your login code. Please try again in a moment.",
  LOGIN_CHALLENGE_EXPIRED: "That took too long. Please enter your email and password again.",
  ACCOUNT_LOCKED:
    "This account has been locked. Please contact support@rydvest.com if you think this is a mistake.",

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
  ACCOUNT_NAME_MISMATCH: "That account is in a different name. Use a bank account in your own name.",
  ACCOUNT_SAVE_FAILED: "Couldn't save your bank details. Please try again.",
  ACCOUNT_DUPLICATE: "You've already added this account number.",
  ACCOUNT_NOT_FOUND: "We couldn't find that account. Check the number and the bank.",
  ACCOUNT_LOOKUP_UNAVAILABLE:
    "Couldn't confirm that account right now. Please try again in a few minutes.",

  // ── Investing / pools ─────────────────────────────────────────────────────
  POOL_NOT_FOUND: "That pool doesn't exist or is no longer available.",
  POOL_NOT_OPEN: "This pool is no longer accepting investments.",
  POOL_AMOUNT_TOO_SMALL: "Your investment is below the minimum contribution for this pool.",
  POOL_AMOUNT_TOO_LARGE: "That amount is more than what's left to fill this pool.",
  POOL_JUST_FILLED: "This pool just filled up. Pick another one below.",
  POOL_INVALID_AMOUNT: "Please enter a valid amount.",
  POOL_CREATE_FAILED: "Couldn't create your pool. Please try again.",
  POOL_NAME_INVALID: "Give your pool a name between 3 and 80 characters.",
  POOL_NAME_RESERVED:
    "Pick a different name — it can't include Rydvest, Official, Admin, Support or Verified.",
  POOL_ALREADY_OPEN:
    "You already have a pool that hasn't filled up yet. Once it's fully funded and running, you can create another one.",
  POOL_PRODUCT_INACTIVE: "This investment option is currently unavailable.",
  POOL_INVITE_INVALID: "That invite code doesn't match any private pool.",
  PAYMENT_INIT_FAILED: "Couldn't start the payment. Please try again.",
  PAYMENT_NOT_CONFIRMED:
    "We haven't confirmed your payment yet. If you were charged, it will reflect within a few minutes.",

  // ── Funding your balance ──────────────────────────────────────────────────
  DEPOSIT_INVALID_AMOUNT: "Please enter a valid amount to add.",
  DEPOSIT_TOO_SMALL: "The minimum you can add at once is ₦100.",
  DEPOSIT_TOO_MANY_PENDING:
    "You have too many transfers waiting. Please try again shortly.",
  DEPOSIT_DECLARE_FAILED: "Couldn't record your transfer. Please try again.",
  DEPOSIT_NOT_CONFIRMED:
    "We haven't confirmed this payment yet. If you were charged, it will reflect within a few minutes.",
  INSUFFICIENT_BALANCE:
    "You don't have enough in your balance for that. Add money to your account first.",

  // ── Withdrawals ───────────────────────────────────────────────────────────
  WITHDRAW_NO_ACCOUNT: "Add a withdrawal bank account first (Profile → Withdrawal details).",
  WITHDRAW_INVALID_AMOUNT: "Please enter a valid withdrawal amount.",
  WITHDRAW_INSUFFICIENT: "That amount is more than your available balance.",
  WITHDRAW_PENDING_EXISTS: "You already have a pending withdrawal request. Wait for it to be processed.",
  WITHDRAW_FAILED: "Couldn't submit your withdrawal request. Please try again.",

  // ── Identity verification ─────────────────────────────────────────────────
  KYC_ID_NUMBER_INVALID: "Your NIN is exactly 11 digits.",
  KYC_SELFIE_REQUIRED: "Take a photo of your face to continue.",
  KYC_SELFIE_INVALID: "That photo didn't come through. Please take it again.",
  KYC_CAMERA_BLOCKED:
    "We can't reach your camera. Allow camera access in your browser settings, then reload this page.",
  KYC_CAMERA_MISSING: "We couldn't find a camera on this device. Try again on your phone.",
  KYC_CAMERA_INSECURE:
    "Your browser only allows the camera on a secure page. Open this site with https:// and try again.",
  KYC_CAMERA_IN_USE:
    "Another app is already using your camera. Close it, then tap Open camera again.",
  KYC_CAMERA_NOT_READY: "The camera hasn't finished starting. Give it a second and try again.",
  KYC_PHOTO_FAILED: "That photo didn't save. Please take it again.",
  KYC_ALREADY_PENDING: "Your details are already with us. We'll email you when they've been checked.",
  KYC_ALREADY_APPROVED: "Your identity is already verified.",
  KYC_SUBMIT_FAILED: "Couldn't submit your details. Please try again.",
  KYC_REQUIRED:
    "Verify your identity before you can withdraw. Go to Verification to submit your details.",

  // ── Transaction PIN ───────────────────────────────────────────────────────
  PIN_INVALID: "Your PIN must be 4 digits.",
  PIN_TOO_SIMPLE: "Pick a less obvious PIN — not 1234, 0000 or four of the same digit.",
  PIN_MISMATCH: "The two PINs don't match.",
  PIN_CURRENT_WRONG: "That's not your current PIN.",
  PIN_NOT_SET: "Set up your transaction PIN first.",
  PIN_WRONG: "Wrong PIN.",
  PIN_LOCKED: "Too many wrong tries. Your PIN is locked for a short while.",
  PIN_REQUIRED: "Enter your 4-digit PIN to continue.",
  PIN_SET_FAILED: "Couldn't save your PIN. Please try again.",
  PIN_PASSWORD_WRONG: "That password is not correct.",

  // ── Sending to another account ────────────────────────────────────────────
  TRANSFER_CODE_INVALID: "That doesn't look like an account ID. They start with RYD.",
  TRANSFER_RECIPIENT_NOT_FOUND: "No account has that ID. Check it and try again.",
  TRANSFER_TO_SELF: "That's your own account ID.",
  TRANSFER_RECIPIENT_UNAVAILABLE: "You can't send to that account right now.",
  TRANSFER_TOO_MANY_LOOKUPS:
    "Too many tries. Please wait a few minutes before checking another ID.",
  TRANSFER_TOO_MANY: "You've sent several transfers in the last hour. Please try again later.",
  TRANSFER_DAILY_LIMIT_REACHED: "You've sent all you can for today. Please try again tomorrow.",
  TRANSFER_INVALID_AMOUNT: "Enter a whole naira amount to send.",
  TRANSFER_NOT_CONFIRMED: "Check the name, then confirm to send.",
  TRANSFER_FAILED: "Couldn't send that transfer. Please try again.",

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_PRODUCT_INVALID: "Please fill in all product fields with valid values.",
  ADMIN_BREAKDOWN_MISMATCH:
    "The cost breakdown must add up to the pool price exactly.",
  ADMIN_ACTION_FAILED: "That action failed. Please try again.",
  DEPOSIT_NARRATION_REQUIRED: "Add the narration from the bank alert — it goes on the user's receipt.",
  ADMIN_USER_NOT_FOUND: "User not found.",
  ADMIN_NOT_ON_SELF: "You cannot do that to your own account.",
  ADMIN_NOT_ON_ADMIN: "Admin accounts cannot be locked or deleted from here.",
  ADMIN_LOCK_REASON_REQUIRED: "Say why this account is being locked — it goes on the audit record.",
  ADMIN_DELETE_CONFIRM: "Type the user's email exactly to confirm.",
  ADMIN_DELETE_HAS_RECORDS:
    "This account has money records, so it cannot be deleted without breaking the ledger. Lock it instead.",
  PAYOUT_REASON_REQUIRED: "Say why this payout is being reverted — it goes on the audit record.",
  ADMIN_KYC_NOT_FOUND: "That verification request no longer exists.",
  ADMIN_KYC_ALREADY_REVIEWED: "Somebody has already decided this one.",
  ADMIN_KYC_REASON_REQUIRED: "Say why this is being rejected — the user is shown your reason.",
  ADMIN_KYC_DECRYPT_FAILED:
    "Couldn't read that number. The KYC_ENCRYPTION_KEY may have changed since it was stored.",
  ADMIN_KYC_LOOKUP_FAILED:
    "The NIN check didn't complete. Check the Monnify keys and wallet balance, then run it again.",
  ADMIN_KYC_LOOKUP_RUNNING: "That check is already running. Give it a moment.",

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
 * Messages that have to quote a number the database only knows at the moment
 * the action fails — someone else having taken part of a pool, for instance.
 * They live here with the rest of the copy; only the figure comes from outside.
 */
export const DYNAMIC_ERRORS = {
  /**
   * Shown when somebody else took part of the pool while this user had the
   * page open. `remaining` is already formatted, e.g. "₦900,000".
   */
  POOL_TRY_LESS: (remaining: string) => `That's more than what's left. Try ${remaining} or less.`,

  /** The floor this pool asks for per person. `minimum` is already formatted. */
  POOL_MINIMUM: (minimum: string) => `This pool takes ${minimum} or more per person.`,

  /** How many tries are left before the PIN locks. */
  PIN_ATTEMPTS_LEFT: (left: number) =>
    left === 1 ? "Wrong PIN. One more try before it locks." : `Wrong PIN. ${left} tries left.`,

  /** Transfer limits. Each figure is already formatted. */
  TRANSFER_MINIMUM: (minimum: string) => `The smallest you can send is ${minimum}.`,
  TRANSFER_MAXIMUM: (maximum: string) => `The most you can send at once is ${maximum}.`,
  TRANSFER_REMAINING_TODAY: (remaining: string) => `You can send ${remaining} more today.`,
} as const;

/**
 * Maps the machine-readable `reason` codes returned by the SQL functions
 * (supabase/schema.sql) to catalog messages, so DB-enforced rules surface as
 * friendly text.
 */
export const DB_REASON_TO_ERROR: Record<string, string> = {
  not_authenticated: ERRORS.AUTH_NOT_LOGGED_IN,
  account_locked: ERRORS.ACCOUNT_LOCKED,
  kyc_required: ERRORS.KYC_REQUIRED,
  pin_not_set: ERRORS.PIN_NOT_SET,
  pin_wrong: ERRORS.PIN_WRONG,
  pin_locked: ERRORS.PIN_LOCKED,
  pin_invalid: ERRORS.PIN_INVALID,
  pin_too_simple: ERRORS.PIN_TOO_SIMPLE,
  current_pin_wrong: ERRORS.PIN_CURRENT_WRONG,
  invalid_code: ERRORS.TRANSFER_CODE_INVALID,
  recipient_not_found: ERRORS.TRANSFER_RECIPIENT_NOT_FOUND,
  self_transfer: ERRORS.TRANSFER_TO_SELF,
  recipient_unavailable: ERRORS.TRANSFER_RECIPIENT_UNAVAILABLE,
  too_many_lookups: ERRORS.TRANSFER_TOO_MANY_LOOKUPS,
  too_many_transfers: ERRORS.TRANSFER_TOO_MANY,
  invalid_amount: ERRORS.WITHDRAW_INVALID_AMOUNT,
  account_not_found: ERRORS.WITHDRAW_NO_ACCOUNT,
  name_mismatch: ERRORS.ACCOUNT_NAME_MISMATCH,
  pending_request_exists: ERRORS.WITHDRAW_PENDING_EXISTS,
  insufficient_balance: ERRORS.WITHDRAW_INSUFFICIENT,
  pool_full_refund_pending: ERRORS.POOL_AMOUNT_TOO_LARGE,
  too_many_pending_deposits: ERRORS.DEPOSIT_TOO_MANY_PENDING,
  pool_not_found: ERRORS.POOL_NOT_FOUND,
  pool_not_open: ERRORS.POOL_NOT_OPEN,
  product_inactive: ERRORS.POOL_PRODUCT_INACTIVE,
  amount_too_large: ERRORS.POOL_AMOUNT_TOO_LARGE,
  amount_too_small: ERRORS.POOL_AMOUNT_TOO_SMALL,
  deposit_not_found: ERRORS.ADMIN_ACTION_FAILED,
  payout_not_found: ERRORS.ADMIN_ACTION_FAILED,
  not_paid: ERRORS.ADMIN_ACTION_FAILED,
  not_reverted: ERRORS.ADMIN_ACTION_FAILED,
  unexpected_status: ERRORS.ADMIN_ACTION_FAILED,
};
