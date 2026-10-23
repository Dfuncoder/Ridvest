/**
 * ADMIN → VERIFICATION — the queue of identity submissions.
 *
 * The decision is a human one: does the face in the photo plausibly belong to
 * the person whose name, age and ID number are printed beside it. So the photo
 * is shown large, next to everything on file about that account, rather than
 * as a thumbnail in a table row.
 *
 * Selfies live in a private bucket. Each render mints a signed link that
 * expires in five minutes, so nothing here survives being copied into a chat.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import KycDecision from "@/components/admin/KycActions";
import RevealNumber from "@/components/admin/RevealNumber";
import NinCheck from "@/components/admin/NinCheck";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Verification · Rydvest admin" };

/** Signed links are short-lived on purpose. */
const SIGNED_URL_TTL_SECONDS = 300;

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.14em]";

const STATUSES = ["pending", "approved", "rejected", "all"] as const;
type Status = (typeof STATUSES)[number];

const BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

type Profile = {
  full_name: string | null;
  email: string;
  phone: string | null;
  dob: string | null;
  state_of_residence: string | null;
  user_code: string | null;
  created_at: string;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}

/** Years between a date of birth and today — the number worth eyeballing. */
function ageFrom(dob: string | null): string {
  if (!dob) return "—";
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;
  return `${age}`;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={`${eyebrow} text-slate-400`}>{label}</dt>
      <dd
        className={`text-sm font-semibold text-slate-900 truncate ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { status: raw } = await searchParams;
  const status: Status = (STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as Status)
    : "pending";

  // kyc_submissions has two foreign keys into profiles (the user, and whoever
  // reviewed it), so both embeds have to name their constraint — an ambiguous
  // embed fails the whole query.
  let query = admin
    .from("kyc_submissions")
    .select(
      `id, user_id, id_type, id_number_last4, selfie_path, status, admin_note, created_at, reviewed_at,
       lookup_status, lookup_first_name, lookup_last_name, lookup_dob, lookup_gender, lookup_phone, lookup_error, lookup_at,
       user:profiles!kyc_submissions_user_id_fkey(full_name, email, phone, dob, state_of_residence, user_code, created_at),
       reviewer:profiles!kyc_submissions_reviewed_by_fkey(full_name)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);

  const [{ data: rows, error }, { count: pendingCount }, { count: approvedCount }, { count: rejectedCount }] =
    await Promise.all([
      query,
      admin
        .from("kyc_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("kyc_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      admin
        .from("kyc_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

  if (error) console.error("[admin] kyc query failed", error);

  const submissions = rows ?? [];

  // One batch call rather than one per card.
  const signed = new Map<string, string>();
  if (submissions.length > 0) {
    const { data: links, error: signError } = await admin.storage
      .from("kyc")
      .createSignedUrls(
        submissions.map((s) => s.selfie_path),
        SIGNED_URL_TTL_SECONDS
      );
    if (signError) console.error("[admin] kyc signed urls failed", signError);
    for (const link of links ?? []) {
      if (link.signedUrl && link.path) signed.set(link.path, link.signedUrl);
    }
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Verification</h1>
        <p className="text-sm text-slate-500 mt-1">
          Check the face against the name and the ID, then decide. Nobody can withdraw until you
          approve them.
        </p>
      </div>

      {/* ── COUNTS ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          {
            label: "Waiting",
            value: String(pendingCount ?? 0),
            tone: pendingCount ? "text-amber-600" : "text-slate-300",
          },
          { label: "Approved", value: String(approvedCount ?? 0), tone: "text-green-600" },
          {
            label: "Rejected",
            value: String(rejectedCount ?? 0),
            tone: rejectedCount ? "text-red-500" : "text-slate-300",
          },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3.5">
            <p className={`${eyebrow} text-slate-400 mb-1`}>{t.label}</p>
            <p className={`text-base font-extrabold tabular-nums tracking-tight ${t.tone}`}>
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── FILTER ── */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/kyc?status=${s}`}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition-colors ${
              s === status
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s === "pending" ? "Waiting" : s}
          </Link>
        ))}
      </div>

      {/* ── THE QUEUE ── */}
      {submissions.length === 0 ? (
        <Card className="px-5 py-12">
          <p className="text-sm text-slate-500 text-center">
            {status === "pending"
              ? "Nothing waiting — every submission has been decided."
              : `No ${status === "all" ? "" : status + " "}submissions.`}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((s) => {
            const user = s.user as unknown as Profile | null;
            const reviewer = s.reviewer as unknown as { full_name: string | null } | null;
            const url = signed.get(s.selfie_path);

            return (
              <Card key={s.id} className="overflow-hidden">
                <div className="grid gap-0 md:grid-cols-[260px_1fr]">
                  {/* The photo */}
                  <div className="relative aspect-4/3 md:aspect-auto md:min-h-64 bg-slate-900 grid place-items-center">
                    {url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- a signed, expiring URL; the optimiser must not cache it */
                      <img
                        src={url}
                        alt={`Verification photo for ${user?.full_name ?? "this user"}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <p className="px-4 text-center text-xs text-slate-400">
                        Photo unavailable
                      </p>
                    )}
                  </div>

                  {/* Everything on file */}
                  <div className="p-5 flex flex-col gap-4 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                          {user?.full_name ?? "—"}
                        </h2>
                        <p className="text-xs text-slate-500 truncate">{user?.email ?? "—"}</p>
                      </div>
                      <span
                        className={`${eyebrow} shrink-0 px-2.5 py-1 rounded-full border capitalize ${BADGE[s.status] ?? ""}`}
                      >
                        {s.status === "pending" ? "Waiting" : s.status}
                      </span>
                    </div>

                    {/* ── WHAT NIMC SAID ──
                        The decisive piece of evidence: the name on the
                        national record, beside the name on the profile. */}
                    <NinCheck
                      status={s.lookup_status}
                      nimcName={[s.lookup_first_name, s.lookup_last_name]
                        .filter(Boolean)
                        .join(" ")}
                      nimcDob={s.lookup_dob}
                      profileName={user?.full_name ?? ""}
                      checkedAt={s.lookup_at}
                      submissionId={s.id}
                    />

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                      <RevealNumber
                        submissionId={s.id}
                        label={s.id_type.toUpperCase()}
                        last4={s.id_number_last4}
                      />
                      <Field label="Age" value={ageFrom(user?.dob ?? null)} />
                      <Field label="Phone" value={user?.phone || "—"} />
                      <Field label="State" value={user?.state_of_residence || "—"} />
                      <Field label="Account ID" value={user?.user_code || "—"} mono />
                      <Field
                        label="Joined"
                        value={user?.created_at ? fmtDate(user.created_at) : "—"}
                      />
                    </dl>

                    <p className="text-xs text-slate-400">
                      Submitted {fmtDateTime(s.created_at)}
                      {s.reviewed_at && (
                        <>
                          {" · "}
                          {s.status === "approved" ? "approved" : "rejected"}{" "}
                          {fmtDateTime(s.reviewed_at)} by {reviewer?.full_name ?? "an admin"}
                        </>
                      )}
                    </p>

                    {s.status === "rejected" && s.admin_note && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
                        {s.admin_note}
                      </p>
                    )}

                    {s.status === "pending" && (
                      <div className="mt-auto flex flex-col gap-2">
                        <KycDecision submissionId={s.id} />
                        <Link
                          href={`/admin/users/${s.user_id}`}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Open the full account record →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400">
        Showing up to 200, newest first. Photo links expire five minutes after this page loads —
        reload to see them again.
      </p>
    </div>
  );
}
