/**
 * Reads the admin-configurable rows in app_settings.
 * Every value has a safe fallback so a missing row never breaks a page.
 */
import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { isNinProvider, type NinProvider } from "./nin";

export type PaymentMethod = "korapay" | "manual";

export type PaymentSettings = {
  method: PaymentMethod;
  bankName: string;
  accountName: string;
  accountNumber: string;
  notifyEmails: string[];
};

const DEFAULTS: PaymentSettings = {
  method: "manual",
  bankName: "GTBank",
  accountName: "RYDVEST LTD",
  accountNumber: "3005411584",
  notifyEmails: ["info@rydvest.com"],
};

const KEYS = [
  "payment_method",
  "bank_name",
  "bank_account_name",
  "bank_account_number",
  "deposit_notify_emails",
] as const;

export function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .filter((e, i, all) => all.indexOf(e) === i);
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", KEYS as unknown as string[]);

  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const emails = parseEmailList(map.get("deposit_notify_emails") ?? "");

  return {
    method: map.get("payment_method") === "korapay" ? "korapay" : "manual",
    bankName: map.get("bank_name") || DEFAULTS.bankName,
    accountName: map.get("bank_account_name") || DEFAULTS.accountName,
    accountNumber: map.get("bank_account_number") || DEFAULTS.accountNumber,
    notifyEmails: emails.length > 0 ? emails : DEFAULTS.notifyEmails,
  };
}

// ── Limits, fees and the two service switches ───────────────────────────────
//
// Mirrors the defaults in supabase/migrate-configurable-limits.sql. The SQL is
// what binds — these values are read for display and for the admin form, and
// the fallbacks exist so a page still renders if a row is missing.

export type MoneySettings = {
  transferMinAmount: number;
  transferMaxAmount: number;
  transferMaxPerDay: number;
  transferMaxPerHour: number;
  transferMaxLookupsHour: number;
  transferFee: number;
  withdrawalFee: number;
  transfersEnabled: boolean;
  withdrawalsEnabled: boolean;
};

const MONEY_DEFAULTS: MoneySettings = {
  transferMinAmount: 100,
  transferMaxAmount: 2_000_000,
  transferMaxPerDay: 5_000_000,
  transferMaxPerHour: 10,
  transferMaxLookupsHour: 30,
  transferFee: 50,
  withdrawalFee: 0,
  transfersEnabled: true,
  withdrawalsEnabled: true,
};

/** Numeric keys, in the order the admin form shows them. */
export const MONEY_KEYS = {
  transferMinAmount: "transfer_min_amount",
  transferMaxAmount: "transfer_max_amount",
  transferMaxPerDay: "transfer_max_per_day",
  transferMaxPerHour: "transfer_max_per_hour",
  transferMaxLookupsHour: "transfer_max_lookups_hour",
  transferFee: "transfer_fee",
  withdrawalFee: "withdrawal_fee",
} as const;

export const SWITCH_KEYS = {
  transfersEnabled: "transfers_enabled",
  withdrawalsEnabled: "withdrawals_enabled",
} as const;

/**
 * Same rule as setting_num() in SQL: only a plain non-negative number counts,
 * anything else falls back. Both sides have to agree, or the form would show
 * one figure while the database enforced another.
 */
function num(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flag(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(v)) return true;
  if (["0", "false", "off", "no"].includes(v)) return false;
  return fallback;
}

export async function getMoneySettings(): Promise<MoneySettings> {
  const admin = createSupabaseAdminClient();
  const keys = [...Object.values(MONEY_KEYS), ...Object.values(SWITCH_KEYS)];
  const { data } = await admin.from("app_settings").select("key, value").in("key", keys);

  const map = new Map((data ?? []).map((r) => [r.key, r.value as string]));

  return {
    transferMinAmount: num(map.get(MONEY_KEYS.transferMinAmount), MONEY_DEFAULTS.transferMinAmount),
    transferMaxAmount: num(map.get(MONEY_KEYS.transferMaxAmount), MONEY_DEFAULTS.transferMaxAmount),
    transferMaxPerDay: num(map.get(MONEY_KEYS.transferMaxPerDay), MONEY_DEFAULTS.transferMaxPerDay),
    transferMaxPerHour: num(map.get(MONEY_KEYS.transferMaxPerHour), MONEY_DEFAULTS.transferMaxPerHour),
    transferMaxLookupsHour: num(
      map.get(MONEY_KEYS.transferMaxLookupsHour),
      MONEY_DEFAULTS.transferMaxLookupsHour
    ),
    transferFee: num(map.get(MONEY_KEYS.transferFee), MONEY_DEFAULTS.transferFee),
    withdrawalFee: num(map.get(MONEY_KEYS.withdrawalFee), MONEY_DEFAULTS.withdrawalFee),
    transfersEnabled: flag(map.get(SWITCH_KEYS.transfersEnabled), MONEY_DEFAULTS.transfersEnabled),
    withdrawalsEnabled: flag(
      map.get(SWITCH_KEYS.withdrawalsEnabled),
      MONEY_DEFAULTS.withdrawalsEnabled
    ),
  };
}

// ── Which provider verifies a NIN ───────────────────────────────────────────
//
// Read from the database rather than the environment so it can be changed
// while a provider is down, without a redeploy. The fallback is Korapay:
// whichever is selected, an unconfigured provider reports "unavailable" and
// the submission is kept for an admin to re-run, so a wrong value here costs
// a retry rather than a lost verification.

export const NIN_PROVIDER_KEY = "nin_provider";

export async function getNinProvider(): Promise<NinProvider> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", NIN_PROVIDER_KEY)
    .maybeSingle();

  const value = (data?.value ?? "").trim().toLowerCase();
  return isNinProvider(value) ? value : "korapay";
}
