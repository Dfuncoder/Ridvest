/**
 * ADMIN → SETTINGS — how users fund their balance, who gets told when a bank
 * transfer needs checking, and whether this deployment is actually wired up.
 */
import { requireAdmin } from "@/lib/auth";
import { getPaymentSettings, getMoneySettings } from "@/lib/settings";
import { listBanksForAdmin } from "@/app/actions/admin";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";
import { MoneySettingsForm } from "@/components/admin/MoneySettingsForm";
import { integrationStatus } from "@/lib/health";

export const metadata = { title: "Settings · Rydvest admin" };

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, banks, money] = await Promise.all([
    getPaymentSettings(),
    listBanksForAdmin(),
    getMoneySettings(),
  ]);

  const integrations = integrationStatus();
  const broken = integrations.filter((i) => i.required && !i.ready);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-extrabold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Payment method and transfer notifications.</p>
      </div>

      {/* ── WHAT IS WIRED UP HERE ──
          Environment variables are set per deployment and never travel with
          the code, so a feature that works locally can be dead in production
          with no sign of it anywhere a person would look. Three separate
          failures — a vanished bank dropdown, NIN submissions failing, crons
          not running — all came back to the same cause and were only
          diagnosable from the code. This is so the next one is not.

          Values are never read here; only whether a key is present. */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">This deployment</h2>
            <p className="text-xs text-slate-500">
              What is configured here. Settings differ per environment.
            </p>
          </div>
          <span
            className={`${eyebrow} shrink-0 rounded-full border px-2.5 py-1 ${
              broken.length
                ? "border-red-500/20 bg-red-500/10 text-red-600"
                : "border-green-500/20 bg-green-500/10 text-green-600"
            }`}
          >
            {broken.length ? `${broken.length} not set` : "All set"}
          </span>
        </div>

        <ul className="divide-y divide-slate-100">
          {integrations.map((i) => (
            <li key={i.name} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  i.ready
                    ? "bg-green-500/10 text-green-600"
                    : i.required
                      ? "bg-red-500/10 text-red-600"
                      : "bg-slate-100 text-slate-400"
                }`}
                aria-hidden="true"
              >
                {i.ready ? "✓" : i.required ? "!" : "–"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {i.name}
                  {!i.required && (
                    <span className="ml-2 text-[10px] font-bold text-slate-400">OPTIONAL</span>
                  )}
                </p>
                {!i.ready && (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{i.affects}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      {i.vars.join("  ·  ")}
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {broken.length > 0 && (
          <p className="border-t border-slate-200 bg-slate-50/60 px-5 py-3 text-xs leading-relaxed text-slate-600">
            Add the names above to this deployment&apos;s environment variables, then redeploy —
            they are read at startup, so an existing deployment will not pick them up.
          </p>
        )}
      </div>

      {/* ── LIMITS, FEES AND SWITCHES ──
          Above the payment method on purpose: this is the card somebody opens
          in an emergency, and it should not be below a form about bank
          details. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-sm font-extrabold text-slate-900">Limits, fees &amp; switches</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Saved straight to the database and read on every transaction — no deploy needed. The
            rules are enforced in SQL, so pausing a service here stops it everywhere, not just on
            the screens that hide the button.
          </p>
        </div>
        <MoneySettingsForm settings={money} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <PaymentSettingsForm settings={settings} banks={banks} />
      </div>
    </div>
  );
}
