/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RYDVEST — SERVER-SIDE INPUT VALIDATION (Zod schemas)
 *
 * Every value that reaches the backend is validated HERE, on the server,
 * before it touches Supabase or Paystack. Client-side checks are only a UX
 * nicety — these schemas are the real gate, so a crafted request that skips
 * the UI still can't submit bad data.
 *
 * All error strings come from lib/errors.ts (the editable catalog).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { z } from "zod";
import { ERRORS } from "./errors";

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

/** Strong password: ≥8 chars with a letter, a number and a special character. */
const passwordSchema = z
  .string()
  .min(8, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
  .regex(/[a-zA-Z]/, { error: ERRORS.SIGNUP_PASSWORD_WEAK })
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

// ── Investing ───────────────────────────────────────────────────────────────
export const InvestSchema = z.object({
  poolId: z.uuid({ error: ERRORS.POOL_NOT_FOUND }),
  // Whole naira only; server re-checks against pool min/remaining.
  amount: z.coerce.number().int({ error: ERRORS.POOL_INVALID_AMOUNT }).positive({ error: ERRORS.POOL_INVALID_AMOUNT }).max(1_000_000_000),
});

export const CreatePoolSchema = z.object({
  productId: z.uuid({ error: ERRORS.POOL_PRODUCT_INACTIVE }),
  name: z.string().trim().min(3).max(80),
  isPrivate: z.enum(["true", "false"]).transform((v) => v === "true"),
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
  durationMonths: z.coerce.number().int().min(1).max(120, { error: ERRORS.ADMIN_PRODUCT_INVALID }),
  roiPercent: z.coerce.number().min(0).max(1000, { error: ERRORS.ADMIN_PRODUCT_INVALID }),
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
