/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHICH INTEGRATIONS ARE CONFIGURED IN THIS DEPLOYMENT.
 *
 * Environment variables are set per deployment and never travel with the code,
 * so a feature that works locally can be silently dead in production. The
 * symptom is always the same shrug — "couldn't submit", an empty dropdown, a
 * check that never completes — and the cause is never visible from the screen
 * it broke on.
 *
 * This answers "is it configured here?" without ever revealing a value. Only
 * booleans leave this file: whether a key is present, never what it is.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import "server-only";

export type Integration = {
  name: string;
  /** Whether this deployment can actually do it. */
  ready: boolean;
  /** Plain words: what stops working when it is not configured. */
  affects: string;
  /** The variables involved, for whoever is setting them. */
  vars: string[];
  /** False when the app still works fine without it. */
  required: boolean;
};

const set = (key: string): boolean => Boolean(process.env[key]?.trim());

/** KYC_ENCRYPTION_KEY must decode to exactly 32 bytes, or encryption throws. */
function encryptionKeyUsable(): boolean {
  const raw = process.env.KYC_ENCRYPTION_KEY?.trim();
  if (!raw) return false;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

export function integrationStatus(): Integration[] {
  return [
    {
      name: "Database",
      ready: set("NEXT_PUBLIC_SUPABASE_URL") && set("SUPABASE_SECRET_KEY"),
      affects: "Everything. Nothing works without it.",
      vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"],
      required: true,
    },
    {
      name: "Identity verification",
      ready: encryptionKeyUsable(),
      affects: "Users cannot submit their NIN — the form fails on save.",
      vars: ["KYC_ENCRYPTION_KEY"],
      required: true,
    },
    {
      name: "Bank & NIN lookups",
      ready: set("MONNIFY_API_KEY") && set("MONNIFY_SECRET_KEY"),
      affects:
        "No bank dropdown, no account-name check, and NIN checks never complete.",
      vars: ["MONNIFY_API_KEY", "MONNIFY_SECRET_KEY"],
      required: true,
    },
    {
      name: "Outgoing email",
      ready: set("RESEND_API_KEY"),
      affects: "No receipts, no admin alerts, no replies to messages.",
      vars: ["RESEND_API_KEY"],
      required: true,
    },
    {
      name: "Scheduled jobs",
      ready: set("CRON_SECRET"),
      affects: "Payouts do not settle on their due date and old selfies are never cleared.",
      vars: ["CRON_SECRET"],
      required: true,
    },
    {
      name: "Site address",
      ready: set("NEXT_PUBLIC_SITE_URL"),
      affects: "Password-reset and confirmation links point nowhere.",
      vars: ["NEXT_PUBLIC_SITE_URL"],
      required: true,
    },
    {
      name: "Card payments",
      ready: set("KORAPAY_SECRET_KEY"),
      affects: "Only needed if payments are switched from bank transfer to card.",
      vars: ["KORAPAY_SECRET_KEY"],
      required: false,
    },
  ];
}
