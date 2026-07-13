/**
 * Streaming skeleton for all /dashboard pages — shown instantly while the
 * server fetches data, so navigation never feels stuck on a blank screen.
 */
export default function DashboardLoading() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-44 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200/70 dark:bg-white/10" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
      <div className="h-40 rounded-2xl bg-slate-200/70 dark:bg-white/10" />
    </div>
  );
}
