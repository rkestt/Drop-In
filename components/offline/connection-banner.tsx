"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Banner di connessione: offline / tornato online (d24, stati 02 e 06).
 * - Offline: --warning, tono informativo (l'offline non è un errore).
 * - Riconnessione: --success, sparisce dopo 3s; chiama onRetry per aggiornare i dati.
 */
export function ConnectionBanner({
  ageLabel,
  onRetry,
}: {
  /** Età dei dati in cache, es. "12 min fa" — mostrata solo offline. */
  ageLabel?: string | null;
  /** Chiamato da "Riprova" e alla riconnessione. Default: ricarica la pagina. */
  onRetry?: () => void;
}) {
  // mounted: il server non conosce lo stato rete, quindi il primo render
  // client deve coincidere con il server (null) per non rompere l'hydration.
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [reconnected, setReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      setReconnected(true);
      setDismissed(false);
    };
    const off = () => {
      setOnline(false);
      setReconnected(false);
      setDismissed(false);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!reconnected) return;
    onRetry?.();
    const t = window.setTimeout(() => setReconnected(false), 3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnected]);

  if (dismissed || !mounted) return null;

  if (!online) {
    return (
      <div
        role="status"
        aria-atomic="true"
        className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4"
      >
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Sei offline{ageLabel ? ` · dati di ${ageLabel}` : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          I campi qui sotto sono salvati sul telefono.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              onRetry ? onRetry() : window.location.reload()
            }
          >
            Riprova
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Chiudi
          </Button>
        </div>
      </div>
    );
  }

  if (reconnected) {
    return (
      <div
        role="status"
        aria-atomic="true"
        className="rounded-card border border-[var(--success)]/40 bg-[var(--success)]/10 p-4"
      >
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Di nuovo online
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Aggiorniamo campi e lobby.
        </p>
      </div>
    );
  }

  return null;
}
