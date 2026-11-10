interface StatsRowProps {
  /** `null` = query fallita: si mostra "—" con tooltip, mai 0 inventato. */
  checkIns: number | null;
  created: number | null;
  played: number | null;
}

function StatValue({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <p
        className="m-0 font-display text-2xl font-bold tabular-nums text-[var(--text-secondary)]"
        title="Non disponibile"
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">{label}: non disponibile.</span>
      </p>
    );
  }
  return (
    <p
      className={
        value === 0
          ? "m-0 font-display text-2xl font-bold tabular-nums text-[var(--text-secondary)]"
          : "m-0 font-display text-2xl font-bold tabular-nums"
      }
    >
      {value}
    </p>
  );
}

/** Statistiche reali da check_ins / lobbies / lobby_participants. */
export function StatsRow({ checkIns, created, played }: StatsRowProps) {
  const allZero = checkIns === 0 && created === 0 && played === 0;

  return (
    <section
      aria-labelledby="profile-stats-title"
      className="rounded-card bg-[var(--bg-surface)] p-5"
    >
      <h2 id="profile-stats-title" className="text-base font-semibold m-0">
        I tuoi numeri
      </h2>
      <div className="mt-3 grid grid-cols-3">
        <div className="flex flex-col gap-1 min-w-0 pr-3 border-l-0">
          <StatValue value={checkIns} label="Check-in" />
          <p className="m-0 min-h-7 text-label uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Check-in
          </p>
        </div>
        <div className="flex flex-col gap-1 min-w-0 px-3 border-l border-[var(--border)]">
          <StatValue value={created} label="Lobby create" />
          <p className="m-0 min-h-7 text-label uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Lobby create
          </p>
        </div>
        <div className="flex flex-col gap-1 min-w-0 pl-3 border-l border-[var(--border)]">
          <StatValue value={played} label="Lobby giocate" />
          <p className="m-0 min-h-7 text-label uppercase tracking-wider font-semibold text-[var(--text-muted)]">
            Lobby giocate
          </p>
        </div>
      </div>
      {allZero && (
        <p className="mt-3 m-0 text-[13px] leading-snug text-[var(--text-muted)]">
          Ancora nessun check-in, nessuna lobby. Quando giochi, i numeri
          compaiono qui.
        </p>
      )}
    </section>
  );
}
