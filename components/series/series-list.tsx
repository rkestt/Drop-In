"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteSeries,
  setSeriesActive,
} from "@/lib/series/client";
import { SeriesCard } from "./series-card";
import type { SeriesListItem } from "./types";

/**
 * "Le mie serie" (#92, superficie 2): righe proprie + sezione orfana.
 * Toggle ottimistico con rollback, cancellazione ottimistica (la riga
 * sparisce subito; se il server rifiuta torna con errore inline), toast
 * italiani da spec e annunci `role="status"` (i toast sono aggiuntivi,
 * non l'unica fonte).
 */
export function SeriesList({
  mine,
  orphans,
  loadError,
}: {
  mine: SeriesListItem[];
  orphans: SeriesListItem[];
  loadError: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  // Override ottimistici sopra i props del server (che restano la verità
  // dopo `router.refresh()`): active ribaltato, riga rimossa, errore inline.
  const [overrides, setOverrides] = useState<
    Record<string, { active?: boolean; removed?: boolean; error?: string }>
  >({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [liveMessage, setLiveMessage] = useState("");

  const visible = (items: SeriesListItem[]): SeriesListItem[] =>
    items
      .filter((item) => !overrides[item.id]?.removed)
      .map((item) =>
        overrides[item.id]?.active === undefined
          ? item
          : { ...item, active: overrides[item.id].active as boolean },
      );

  const patch = (
    id: string,
    next: { active?: boolean; removed?: boolean; error?: string },
  ) =>
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...next },
    }));

  const clearOverride = (id: string) =>
    setOverrides((prev) => {
      if (!prev[id]) return prev;
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      if (!busy) {
        if (!prev[id]) return prev;
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: true };
    });

  /** Pausa/riattiva ottimistica: la riga cambia subito, rollback se rifiutata. */
  const toggleActive = async (item: SeriesListItem) => {
    const next = !item.active;
    patch(item.id, { active: next, error: undefined });
    setBusy(item.id, true);
    try {
      const { error } = await setSeriesActive(supabase, item.id, next);
      if (error) {
        patch(item.id, { active: item.active, error });
        setLiveMessage("Non siamo riusciti a cambiare la serie. Riprova.");
        return;
      }
      clearOverride(item.id);
      if (next) {
        toast.success("Serie di nuovo attiva.");
        setLiveMessage("Serie di nuovo attiva.");
      } else {
        toast.success("Serie in pausa. Le partite già in programma restano.");
        setLiveMessage("Serie in pausa. Le partite già in programma restano.");
      }
      router.refresh();
    } finally {
      setBusy(item.id, false);
    }
  };

  /** Cancellazione ottimistica: la riga sparisce, torna con errore se rifiutata. */
  const removeSeries = async (item: SeriesListItem) => {
    patch(item.id, { removed: true, error: undefined });
    setBusy(item.id, true);
    try {
      const { error } = await deleteSeries(supabase, item.id);
      if (error) {
        patch(item.id, {
          removed: false,
          error: "Non siamo riusciti a cancellare la serie. Riprova.",
        });
        setLiveMessage("Non siamo riusciti a cancellare la serie. Riprova.");
        return;
      }
      toast.success("Serie cancellata. Le partite in programma restano.");
      setLiveMessage("Serie cancellata. Le partite in programma restano.");
      router.refresh();
    } finally {
      setBusy(item.id, false);
    }
  };

  /**
   * Kill-switch orfana (#92 decisione 4 + RLS 044: solo `active true→false`,
   * irreversibile). Stessa forma della cancellazione; nessun toast dedicato
   * in spec: annuncio via `role="status"`.
   */
  const stopOrphan = async (item: SeriesListItem) => {
    patch(item.id, { removed: true, error: undefined });
    setBusy(item.id, true);
    try {
      const { error } = await setSeriesActive(supabase, item.id, false);
      if (error) {
        patch(item.id, {
          removed: false,
          error: "Non siamo riusciti a fermare la serie. Riprova.",
        });
        setLiveMessage("Non siamo riusciti a fermare la serie. Riprova.");
        return;
      }
      setLiveMessage("Serie fermata. Le partite in programma restano.");
      router.refresh();
    } finally {
      setBusy(item.id, false);
    }
  };

  if (loadError) {
    return (
      <div className="py-8 text-center" role="alert">
        <p className="font-medium text-[var(--text-primary)]">
          Non riusciamo a caricare le tue serie.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mx-auto mt-3 flex min-h-[44px] items-center justify-center rounded-control bg-[var(--bg-surface)] px-4 font-semibold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
        >
          Riprova
        </button>
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>
      </div>
    );
  }

  const visibleMine = visible(mine);
  const visibleOrphans = visible(orphans);

  if (visibleMine.length === 0 && visibleOrphans.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center py-8 text-center">
        <Repeat
          className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <p className="text-xl font-semibold text-[var(--text-primary)]">
          Nessuna serie
        </p>
        <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
          Quando crei una lobby puoi renderla ripetibile: diventa il tuo
          appuntamento fisso al campo.
        </p>
        <Link
          href="/"
          className="mx-auto mt-3 flex min-h-[44px] w-full max-w-60 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
        >
          Trova un campo
        </Link>
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <ul className="space-y-3">
        {visibleMine.map((item) => (
          <SeriesCard
            key={item.id}
            item={item}
            busy={busyIds[item.id] === true}
            externalError={overrides[item.id]?.error ?? null}
            onToggle={toggleActive}
            onStop={removeSeries}
          />
        ))}
      </ul>
      {visibleOrphans.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-label font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Senza organizzatore
          </h2>
          <ul className="mt-3 space-y-3">
            {visibleOrphans.map((item) => (
              <SeriesCard
                key={item.id}
                item={item}
                orphan
                busy={busyIds[item.id] === true}
                externalError={overrides[item.id]?.error ?? null}
                onToggle={toggleActive}
                onStop={stopOrphan}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
