/**
 * DASHBOARD OVERVIEW — server component.
 * Fetches the user's real numbers with their OWN session (RLS applies), does
 * the math server-side, and passes plain data to the themed client view.
 */
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Overview, { type OverviewData } from "@/components/dashboard/Overview";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  // All queries are scoped to this user by RLS; run them in parallel.
  const [{ data: balance }, { data: investments }, { data: payouts }] = await Promise.all([
    supabase.rpc("my_available_balance"),
    supabase
      .from("investments")
      .select(
        "id, amount, status, paid_at, pool:pools(id, name, status, amount_raised, started_at, ends_at, product:pool_products(name, target_amount, duration_weeks, roi_percent))"
      )
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
    supabase
      .from("payouts")
      .select("id, investment_id, amount, due_date, status, paid_at")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
  ]);

  const allPayouts = payouts ?? [];
  const paidPayouts = allPayouts.filter((p) => p.status === "paid");
  const nextScheduled = allPayouts.find((p) => p.status === "scheduled") ?? null;

  // Per-investment earned so far (sum of its paid payouts).
  const earnedByInvestment = new Map<string, number>();
  for (const p of paidPayouts) {
    earnedByInvestment.set(
      p.investment_id,
      (earnedByInvestment.get(p.investment_id) ?? 0) + Number(p.amount)
    );
  }

  const data: OverviewData = {
    balance: Number(balance ?? 0),
    totalInvested: (investments ?? []).reduce((sum, i) => sum + Number(i.amount), 0),
    totalEarned: paidPayouts.reduce((sum, p) => sum + Number(p.amount), 0),
    nextPayout: nextScheduled
      ? { amount: Number(nextScheduled.amount), date: nextScheduled.due_date }
      : null,
    investments: (investments ?? []).map((inv) => {
      // Supabase returns joined rows; single relations come back as objects.
      const pool = inv.pool as unknown as {
        id: string; name: string; status: string; amount_raised: number;
        started_at: string | null; ends_at: string | null;
        product: { name: string; target_amount: number; duration_weeks: number; roi_percent: number };
      };
      const roi = Number(pool.product.roi_percent);
      const invPayouts = allPayouts.filter((p) => p.investment_id === inv.id);
      return {
        id: inv.id,
        poolId: pool.id,
        poolName: pool.name,
        poolStatus: pool.status,
        amount: Number(inv.amount),
        earned: earnedByInvestment.get(inv.id) ?? 0,
        totalExpected: Math.round(Number(inv.amount) * (1 + roi / 100) * 100) / 100,
        weeksTotal: pool.product.duration_weeks,
        weeksDone: invPayouts.filter((p) => p.status === "paid").length,
        // For pools still filling, show fill progress instead of time progress.
        fillPct: pool.product.target_amount
          ? Math.min(100, Math.round((Number(pool.amount_raised) / Number(pool.product.target_amount)) * 100))
          : 0,
        startedAt: pool.started_at,
        endsAt: pool.ends_at,
        nextPayoutDate: invPayouts.find((p) => p.status === "scheduled")?.due_date ?? null,
      };
    }),
    recentPayouts: paidPayouts
      .slice()
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
      .slice(0, 3)
      .map((p) => ({ id: p.id, date: p.paid_at ?? p.due_date, amount: Number(p.amount) })),
  };

  return <Overview data={data} />;
}
