"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { courtDetailKey, readCache } from "@/lib/offline/cache";
import { StaleBadge } from "@/components/offline/stale-badge";

interface CachedCourt {
  name: string;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
}

interface CachedDetail {
  court: CachedCourt;
  openLobbies: number;
  savedAt?: number;
}

/**
 * Shell offline per /courts/<id> (d24, chiude il residuo di d1):
 * - dato in cache → shell leggibile: nome, stale badge, azioni bloccate con spiegazione;
 * - senza cache → messaggio + Riprova + link alla mappa. Mai 404 secco.
 */
export function CourtOfflineShell({ courtId }: { courtId: string }) {
  // Il server non legge localStorage: il primo render client coincide con
  // il server (nessuna cache) e la cache si carica nell'effect. Niente
  // hydration mismatch.
  const [ready, setReady] = useState(false);
  const [cached, setCached] = useState<CachedDetail | null>(null);

  useEffect(() => {
    setCached(readCache<CachedDetail>(courtDetailKey(courtId)));
    setReady(true);
  }, [courtId]);

  if (!ready) {
    // Stesso output del server (che non legge localStorage): attesa neutra,
    // mai il messaggio d'errore prima di aver guardato la cache.
    return (
      <main className="flex flex-1 items-center justify-center" role="status" aria-label="Caricamento campo in corso">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-[var(--bg-surface)] rounded-lg" />
          <div className="h-4 w-64 bg-[var(--bg-surface)] rounded-lg" />
        </div>
        <span className="sr-only">Caricamento campo…</span>
      </main>
    );
  }

  if (!cached) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div role="alert" className="flex max-w-md flex-col items-center gap-3">
          <h1 className="text-display-sm font-bold text-[var(--text-primary)]">
            Non riusciamo a caricare questa pagina.
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            La connessione è caduta e non hai ancora aperto questo campo. Le
            pagine che hai già visitato restano sul telefono.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Riprova
          </Button>
          <Link href="/" className="w-full">
            <Button variant="secondary" className="w-full">
              Torna alla mappa
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const { court, openLobbies } = cached;
  return (
    <main className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Offline</Badge>
        <StaleBadge savedAt={cached.savedAt ?? null} />
      </div>

      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--text-primary)]">
          {court.name}
        </h1>
        <p className="text-[var(--text-secondary)]">
          {court.address || "Indirizzo non disponibile"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {court.surface_type && (
          <Badge variant="default">{court.surface_type}</Badge>
        )}
        {court.hoop_count && (
          <Badge variant="default">{court.hoop_count} canestri</Badge>
        )}
        <Badge variant="accent">
          {openLobbies} {openLobbies === 1 ? "lobby aperta" : "lobby aperte"}
        </Badge>
      </div>

      {/* Stato 03 del prototipo: azione bloccata con spiegazione, mai finto successo. */}
      <div
        role="status"
        aria-atomic="true"
        className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4"
      >
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Serve la connessione per il check-in
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Il check-in dice chi c&apos;è sul campo adesso: senza rete non
          possiamo registrarlo.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" aria-disabled="true" aria-describedby="offline-why">
          Check-in
        </Button>
        <Button variant="secondary" aria-disabled="true" aria-describedby="offline-why">
          Crea lobby
        </Button>
      </div>
      <p id="offline-why" className="text-xs text-[var(--text-muted)]">
        I pulsanti si attivano appena torni online. Non registriamo azioni che
        non possiamo confermare.
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        I dati che vedi possono essere vecchi: ultimo aggiornamento salvato sul
        telefono.
      </p>
    </main>
  );
}
