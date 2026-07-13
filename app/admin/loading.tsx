/**
 * Streaming skeleton for all /admin pages — shown instantly while the
 * server fetches data.
 */
export default function AdminLoading() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-slate-200/70" />
    </div>
  );
}
