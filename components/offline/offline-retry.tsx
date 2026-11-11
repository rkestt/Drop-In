"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  COURTS_CACHE_KEY,
  cacheAge,
  formatCacheAge,
} from "@/lib/offline/cache";

/**
 * CTA + età dei dati per /~offline (stato 13). Client island dentro una
 * pagina statica: l'età si calcola post-mount (il server non ha localStorage).
 */
export function OfflineRetry() {
  const [trying, setTrying] = useState(false);
  const [age, setAge] = useState<string | null>(null);

  useEffect(() => {
    setAge(formatCacheAge(cacheAge(COURTS_CACHE_KEY)));
  }, []);

  const retry = async () => {
    if (trying) return;
    setTrying(true);
    try {
      await fetch("/", { method: "HEAD", cache: "no-store" });
      window.location.href = "/";
    } catch {
      setTrying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        className="w-full"
        onClick={retry}
        aria-disabled={trying}
        aria-busy={trying}
      >
        {trying ? "Sto riprovando…" : "Riprova"}
      </Button>
      {age && (
        <p className="text-xs text-[var(--text-muted)]">
          Ultimo aggiornamento: dati di {age}.
        </p>
      )}
    </div>
  );
}
