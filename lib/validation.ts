/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RYDVEST — SERVER-SIDE INPUT VALIDATION (Zod schemas)
 *
 * Every value that reaches the backend is validated HERE, on the server,
 * before it touches Supabase or Korapay. Client-side checks are only a UX
 * nicety — these schemas are the real gate, so a crafted request that skips
 * the UI still can't submit bad data.
 *
 * All error strings come from lib/errors.ts (the editable catalog).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { z } from "zod";
import { ERRORS } from "./errors";
import { isKnownVehicleImage } from "./vehicles";

/** The 36 Nigerian states + FCT — used for the signup dropdown and validation. */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

/** Nigerian phone: 0801..., 070..., 090..., or the +234 international form. */
const NG_PHONE_REGEX = /^(?:\+?234|0)[789][01]\d{8}$/;

/**
 * Strong password: ≥8 characters with a lowercase letter, an uppercase
 * letter, a number and a symbol.
 *
 * These four classes mirror the Password Requirements setting on the Supabase
 * project, and they have to. Supabase applies its own rule when the account is
 * created, after this one has already passed — so a rule that is looser here
 * produces a form that accepts a password and then fails for a reason the user
 * is never shown. Equal or stricter here is the only safe side to be on.
 */
const passwordSchema = z
  .string()
  .min(8, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
  .regex(/[a-z]/, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
  .regex(/[A-Z]/, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
  .regex(/[0-9]/, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
  .regex(/[^a-zA-Z0-9]/, { error: ERRORS.SIGNUP_PASSWORD_WEAK });

/** Is the person at least 18 years old today? */
function isAdult(dobString: string): boolean {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

// ── Signup ──────────────────────────────────────────────────────────────────
export const SignupSchema = z
  .object({
    fullName: z.string().trim().min(3, { error: ERRORS.SIGNUP_NAME_REQUIRED }).max(120),
    email: z.email({ error: ERRORS.SIGNUP_EMAIL_INVALID }).trim().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    dob: z
      .string()
      .min(1, { error: ERRORS.SIGNUP_DOB_REQUIRED })
      .refine(isAdult, { error: ERRORS.SIGNUP_UNDERAGE }),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, "")) // allow "0801 234 5678" style input
      .refine((v) => NG_PHONE_REGEX.test(v), { error: ERRORS.SIGNUP_PHONE_INVALID }),
    address: z.string().trim().min(5, { error: ERRORS.SIGNUP_ADDRESS_REQUIRED }).max(300),
    state: z.enum(NIGERIAN_STATES, { error: ERRORS.SIGNUP_STATE_REQUIRED }),
    agreedToTerms: z.literal("on", { error: ERRORS.SIGNUP_TERMS_REQUIRED }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: ERRORS.SIGNUP_PASSWORDS_DONT_MATCH,
    path: ["confirmPassword"],
  });


// ── Live checks for the signup form ─────────────────────────────────────────
//
// The same rules as SignupSchema above, exposed one field at a time so the
// register form can show a problem while it is being typed instead of after
// the whole thing is submitted. Deliberately built from the same regexes and
// the same passwordSchema: two copies of a rule is how a form starts accepting
// what the server then rejects.
//
// Nothing here is a security control. SignupSchema still runs on the server,
// and Supabase applies its own rules after that. This is purely so nobody
// fills in six fields to be told the second one was wrong.

export type SignupField =
  | "fullName"
  | "email"
  | "phone"
  | "password"
  | "confirmPassword";

/** The first thing wrong with this value, or null when it is fine. */
export function signupFieldError(
  field: SignupField,
  value: string,
  password = ""
): string | null {
  const v = value.trim();

  switch (field) {
    case "fullName":
      return v.length >= 3 && v.length <= 120 ? null : ERRORS.SIGNUP_NAME_REQUIRED;

    case "email":
      return z.email().safeParse(v.toLowerCase()).success ? null : ERRORS.SIGNUP_EMAIL_INVALID;

    case "phone":
      // Spaces and dashes are stripped before the test, exactly as the schema
      // does, so "0801 234 5678" is not reported as wrong while being typed.
      return NG_PHONE_REGEX.test(v.replace(/[\s-]/g, "")) ? null : ERRORS.SIGNUP_PHONE_INVALID;

    case "password":
      return passwordSchema.safeParse(value).success ? null : ERRORS.SIGNUP_PASSWORD_WEAK;

    case "confirmPassword":
      return value === password ? null : ERRORS.SIGNUP_PASSWORDS_DONT_MATCH;
  }
}

// ── Login ───────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.email({ error: ERRORS.AUTH_INVALID_LOGIN }).trim().toLowerCase(),
  password: z.string().min(1, { error: ERRORS.AUTH_INVALID_LOGIN }),
});

// ── OTP verification ────────────────────────────────────────────────────────
export const OtpSchema = z.object({
  email: z.email({ error: ERRORS.OTP_EMAIL_MISSING }).trim().toLowerCase(),
  token: z.string().regex(/^\d{6}$/, { error: ERRORS.OTP_INVALID }),
});

// ── Forgot / reset password ─────────────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
  email: z.email({ error: ERRORS.SIGNUP_EMAIL_INVALID }).trim().toLowerCase(),
});

export const ResetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: ERRORS.SIGNUP_PASSWORDS_DONT_MATCH,
    path: ["confirmPassword"],
  });


/**
 * Changing the password while signed in.
 *
 * The current password is required because a session is not proof that the
 * person at the keyboard is the owner — a borrowed phone left open is exactly
 * the case this stops.
 */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: ERRORS.PASSWORD_CURRENT_WRONG }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: ERRORS.SIGNUP_PASSWORDS_DONT_MATCH,
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    error: ERRORS.PASSWORD_SAME_AS_CURRENT,
    path: ["password"],
  });

/**
 * Limits, fees and switches set from /admin/settings.
 *
 * Every figure is a whole naira, non-negative, and capped at something no
 * legitimate setting would exceed — an admin with a slipped finger should not
 * be able to set a ₦2,000,000,000 per-transfer ceiling, and a negative fee
 * would pay people to transfer.
 *
 * The ordering rules (minimum below maximum, daily above per-transfer) are
 * checked too: a pair that contradicts each other produces a form nobody can
 * satisfy and support tickets nobody can explain.
 */
const wholeNaira = (max: number) =>
  z.coerce
    .number({ error: "Enter a number." })
    .int({ error: "Whole naira only." })
    .min(0, { error: "Cannot be negative." })
    .max(max, { error: `Too large — the most allowed here is ${max.toLocaleString("en-NG")}.` });

export const MoneySettingsSchema = z
  .object({
    transferMinAmount: wholeNaira(1_000_000),
    transferMaxAmount: wholeNaira(100_000_000),
    transferMaxPerDay: wholeNaira(500_000_000),
    transferMaxPerHour: z.coerce
      .number({ error: "Enter a number." })
      .int({ error: "Whole numbers only." })
      .min(1, { error: "At least 1, or turn transfers off instead." })
      .max(1000, { error: "Too large — 1000 at most." }),
    transferMaxLookupsHour: z.coerce
      .number({ error: "Enter a number." })
      .int({ error: "Whole numbers only." })
      .min(1, { error: "At least 1." })
      .max(1000, { error: "Too large — 1000 at most." }),
    transferFee: wholeNaira(100_000),
    withdrawalFee: wholeNaira(100_000),
    transfersEnabled: z.boolean(),
    withdrawalsEnabled: z.boolean(),
  })
  .refine((d) => d.transferMinAmount <= d.transferMaxAmount, {
    error: "The minimum cannot be above the maximum.",
    path: ["transferMinAmount"],
  })
  .refine((d) => d.transferMaxAmount <= d.transferMaxPerDay, {
    error: "The daily total cannot be below a single transfer.",
    path: ["transferMaxPerDay"],
  })
  .refine((d) => d.transferFee < d.transferMinAmount, {
    error: "The fee must be smaller than the smallest transfer allowed.",
    path: ["transferFee"],
  });

// ── Profile update ──────────────────────────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(3, { error: ERRORS.SIGNUP_NAME_REQUIRED }).max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => NG_PHONE_REGEX.test(v), { error: ERRORS.SIGNUP_PHONE_INVALID }),
  address: z.string().trim().min(5, { error: ERRORS.SIGNUP_ADDRESS_REQUIRED }).max(300),
  state: z.enum(NIGERIAN_STATES, { error: ERRORS.SIGNUP_STATE_REQUIRED }),
});

// ── Withdrawal bank account ─────────────────────────────────────────────────
export const WithdrawalAccountSchema = z.object({
  bankName: z.string().trim().min(2, { error: ERRORS.ACCOUNT_BANK_REQUIRED }).max(100),
  accountNumber: z.string().trim().regex(/^\d{10}$/, { error: ERRORS.ACCOUNT_NUMBER_INVALID }),
  accountName: z.string().trim().min(3, { error: ERRORS.ACCOUNT_NAME_REQUIRED }).max(120),
});

// ── Withdrawal request ──────────────────────────────────────────────────────
export const WithdrawalRequestSchema = z.object({
  accountId: z.uuid({ error: ERRORS.WITHDRAW_NO_ACCOUNT }),
  amount: z.coerce.number().positive({ error: ERRORS.WITHDRAW_INVALID_AMOUNT }).max(1_000_000_000),
});

// ── Transaction PIN ─────────────────────────────────────────────────────────
// Four digits exactly. The obvious ones are rejected in SQL as well, because
// this schema is only the first gate.
const OBVIOUS_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "1212", "2121", "0123", "9876", "1004", "2580",
]);

export const PinSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, { error: ERRORS.PIN_INVALID });

export const NewPinSchema = PinSchema.refine((v) => !OBVIOUS_PINS.has(v), {
  error: ERRORS.PIN_TOO_SIMPLE,
});

export const SetPinSchema = z
  .object({
    pin: NewPinSchema,
    confirmPin: z.string().trim(),
    currentPin: z.string().trim().optional().default(""),
  })
  .refine((v) => v.pin === v.confirmPin, {
    error: ERRORS.PIN_MISMATCH,
    path: ["confirmPin"],
  });

// ── Sending to another account ──────────────────────────────────────────────
// The account ID is normalised the same way as normalise_user_code() in SQL:
// strip anything that is not a letter or digit, then uppercase. People retype
// these with spaces and hyphens, and the alphabet has no I, L, O, U, 0 or 1 to
// confuse. The server re-checks all of this; these rules only mean the user
// hears about a typo without a round trip.
const USER_CODE_REGEX = /^RYD[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export const normaliseUserCode = (v: string): string =>
  v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

export const TransferSchema = z.object({
  code: z
    .string()
    .transform(normaliseUserCode)
    .refine((v) => USER_CODE_REGEX.test(v), { error: ERRORS.TRANSFER_CODE_INVALID }),
  amount: z.coerce
    .number()
    .int({ error: ERRORS.TRANSFER_INVALID_AMOUNT })
    .positive({ error: ERRORS.TRANSFER_INVALID_AMOUNT })
    .max(1_000_000_000, { error: ERRORS.TRANSFER_INVALID_AMOUNT }),
  note: z.string().trim().max(140).optional().default(""),
});

export const UserCodeSchema = z
  .string()
  .transform(normaliseUserCode)
  .refine((v) => USER_CODE_REGEX.test(v), { error: ERRORS.TRANSFER_CODE_INVALID });

// ── Identity verification ───────────────────────────────────────────────────
// The selfie is NOT validated here — a Zod schema cannot tell an image from a
// renamed executable. submitKyc checks the bytes themselves.
// NIN only. BVN was dropped: the NIN lookup returns the name on the national
// record, which is what makes the check worth anything, and offering two kinds
// of number only gave people a way to pick the one nobody would check.
export const KycSubmissionSchema = z.object({
  // An NIN is 11 digits. Spaces and hyphens are stripped first, because people
  // read these off a slip in groups.
  idNumber: z
    .string()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .refine((v) => /^[0-9]{11}$/.test(v), { error: ERRORS.KYC_ID_NUMBER_INVALID }),
});

// ── Investing ───────────────────────────────────────────────────────────────
export const InvestSchema = z.object({
  poolId: z.uuid({ error: ERRORS.POOL_NOT_FOUND }),
  // Whole naira only; server re-checks against pool min/remaining.
  amount: z.coerce.number().int({ error: ERRORS.POOL_INVALID_AMOUNT }).positive({ error: ERRORS.POOL_INVALID_AMOUNT }).max(1_000_000_000),
});

export const FundWalletSchema = z.object({
  amount: z.coerce
    .number()
    .int({ error: ERRORS.DEPOSIT_INVALID_AMOUNT })
    .positive({ error: ERRORS.DEPOSIT_INVALID_AMOUNT })
    .min(100, { error: ERRORS.DEPOSIT_TOO_SMALL })
    .max(1_000_000_000, { error: ERRORS.DEPOSIT_INVALID_AMOUNT }),
});

/**
 * The bank fields describe where users send a MANUAL transfer, so they are
 * only required when that is the method being saved. Validating them
 * unconditionally meant a blank or odd account number blocked the switch to
 * Korapay, where those fields are not used at all.
 */
export const PaymentSettingsSchema = z
  .object({
    method: z.enum(["korapay", "manual"]),
    bankName: z.string().trim().max(60),
    accountName: z.string().trim().max(80),
    accountNumber: z.string().trim().max(20),
    notifyEmails: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.method !== "manual") return;

    if (v.bankName.length < 2) {
      ctx.addIssue({ code: "custom", path: ["bankName"], message: ERRORS.ACCOUNT_BANK_REQUIRED });
    }
    if (v.accountName.length < 2) {
      ctx.addIssue({ code: "custom", path: ["accountName"], message: ERRORS.ACCOUNT_NAME_REQUIRED });
    }
    if (!/^\d{10}$/.test(v.accountNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNumber"],
        message: ERRORS.ACCOUNT_NUMBER_INVALID,
      });
    }
  });

// A user-created pool is always private, so there is no isPrivate field to
// accept here (see createPool and the pools_force_private trigger).
/**
 * Words a user may not put in their own pool's name.
 *
 * A private pool's name is shown to everyone the invite code is shared with,
 * beside the real pool option. Without this, somebody could name theirs
 * "Rydvest Official Pool" and pass it off as ours to people they invite —
 * which is the whole setup for a scam that we would be hosting.
 */
const RESERVED_POOL_WORDS = [
  "rydvest",
  "official",
  "admin",
  "support",
  "verified",
];

export const CreatePoolSchema = z.object({
  productId: z.uuid({ error: ERRORS.POOL_PRODUCT_INACTIVE }),
  name: z
    .string()
    .trim()
    .min(3, { error: ERRORS.POOL_NAME_INVALID })
    .max(80, { error: ERRORS.POOL_NAME_INVALID })
    .refine(
      (v) => {
        const lower = v.toLowerCase();
        return !RESERVED_POOL_WORDS.some((w) => lower.includes(w));
      },
      { error: ERRORS.POOL_NAME_RESERVED }
    ),
});

export const JoinByInviteSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, { error: ERRORS.POOL_INVITE_INVALID }),
});

// ── Admin: pool product create/update ───────────────────────────────────────
export const PoolProductSchema = z.object({
  name: z.string().trim().min(2, { error: ERRORS.ADMIN_PRODUCT_INVALID }).max(80),
  description: z.string().trim().max(500).optional().default(""),
  targetAmount: z.coerce.number().positive({ error: ERRORS.ADMIN_PRODUCT_INVALID }).max(10_000_000_000),
  minContribution: z.coerce.number().positive({ error: ERRORS.ADMIN_PRODUCT_INVALID }),
  durationWeeks: z.coerce.number().int().min(1).max(520, { error: ERRORS.ADMIN_PRODUCT_INVALID }),
  roiPercent: z.coerce.number().min(0).max(1000, { error: ERRORS.ADMIN_PRODUCT_INVALID }),
  // Must be one of the bundled vehicle photos — never a free-text path, which
  // would let an admin point a pool card at any URL. Empty means "work it out
  // from the name" (lib/vehicles.ts).
  imagePath: z
    .string()
    .trim()
    .refine((v) => v === "" || isKnownVehicleImage(v), { error: ERRORS.ADMIN_PRODUCT_INVALID })
    .optional()
    .default(""),

  // Which kind of pool may be built from this option. Public options never
  // appear when a user starts a private pool, and vice versa.
  availability: z.enum(["public", "private", "both"]).optional().default("both"),

  // Per-option floor for a private pool. Blank falls back to the global one.
  privateMinContribution: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0), {
      error: ERRORS.ADMIN_PRODUCT_INVALID,
    }),

  // The cost breakdown. All five or none — a half-filled one would display
  // zeros as if they were real figures.
  assetValue: z.coerce.number().min(0).optional().default(0),
  vat: z.coerce.number().min(0).optional().default(0),
  serviceCharge: z.coerce.number().min(0).optional().default(0),
  maintenanceFee: z.coerce.number().min(0).optional().default(0),
  companyCharge: z.coerce.number().min(0).optional().default(0),
});

// ── Contact form ────────────────────────────────────────────────────────────
export const ContactSchema = z.object({
  name: z.string().trim().min(2, { error: ERRORS.CONTACT_NAME_REQUIRED }).max(120),
  email: z.email({ error: ERRORS.CONTACT_EMAIL_INVALID }).trim().toLowerCase(),
  phone: z.string().trim().max(20).optional().default(""),
  message: z.string().trim().min(10, { error: ERRORS.CONTACT_MESSAGE_REQUIRED }).max(3000),
});

/**
 * Helper: turn a Zod error into `{ fieldName: "first message" }` for easy
 * display under form fields.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
