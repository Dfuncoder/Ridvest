/**
 * ADMIN → SETTINGS — how users fund their balance, and who gets told when a
 * bank transfer needs checking.
 */
import { requireAdmin } from "@/lib/auth";
import { getPaymentSettings } from "@/lib/settings";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";

export const metadata = { title: "Settings · Rydvest admin" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getPaymentSettings();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Payment method and transfer notifications.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <PaymentSettingsForm settings={settings} />
      </div>
    </div>
  );
}
