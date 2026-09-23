/**
 * Reads the admin-configurable rows in app_settings.
 * Every value has a safe fallback so a missing row never breaks a page.
 */
import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

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
