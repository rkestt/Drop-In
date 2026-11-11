/**
 * Skeleton del profilo: stessa struttura e altezze del contenuto reale
 * (niente layout shift), `aria-busy` + status solo per screen reader.
 */
export default function ProfileLoading() {
  return (
    <main id="contenuto" tabIndex={-1} className="flex-1 w-full max-w-[720px] mx-auto p-4 flex flex-col gap-3.5" aria-busy="true">
      <p role="status" className="sr-only">
        Caricamento del profilo…
      </p>

      <div aria-hidden="true" className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2">
        <div className="w-[72px] h-[72px] rounded-chip animate-shimmer" />
        <div className="min-w-0">
          <div className="w-28 h-6 rounded-control-sm animate-shimmer" />
          <div className="w-40 h-3.5 mt-2 rounded-control-sm animate-shimmer" />
        </div>
        <div className="col-span-full mt-1 h-12 rounded-control animate-shimmer" />
      </div>

      <div aria-hidden="true" className="rounded-card bg-[var(--bg-surface)] p-5 flex flex-col gap-2.5">
        <div className="w-14 h-2.5 rounded-control-sm animate-shimmer" />
        <div className="w-26 h-10 rounded-control-sm animate-shimmer" />
        <div className="w-full h-[10px] rounded-chip animate-shimmer" />
        <div className="w-full h-8 rounded-control-sm animate-shimmer" />
      </div>

      <div aria-hidden="true" className="rounded-card bg-[var(--bg-surface)] p-5">
        <div className="w-28 h-4 rounded-control-sm animate-shimmer" />
        <div className="mt-3 grid grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 px-3 first:ps-0 last:pe-0">
              <div className="w-11 h-5 rounded-control-sm animate-shimmer" />
              <div className="w-[72px] h-2.5 rounded-control-sm animate-shimmer" />
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="rounded-card bg-[var(--bg-surface)] overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 min-h-[56px] px-4">
            <div className="w-[34px] h-[34px] rounded-control-sm animate-shimmer" />
            <div className="w-26 h-3.5 rounded-control-sm animate-shimmer" />
          </div>
        ))}
      </div>
    </main>
  );
}
