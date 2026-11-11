import { Badge } from "@/components/ui/badge";
import { OfflineRetry } from "@/components/offline/offline-retry";

// d24, stato 13 del prototipo. Pagina statica (precached dal SW):
// niente cookies/headers/searchParams/auth. Dice cosa resta e cosa no,
// un solo next step (Riprova).
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold uppercase tracking-widest text-[var(--text-primary)]">
          Drop-In
        </p>
        <Badge variant="warning">Offline</Badge>
      </div>

      <h1 className="text-display font-bold text-[var(--text-primary)]">
        Sei offline.
      </h1>
      <p className="text-sm text-[var(--text-secondary)]">
        Drop-In non raggiunge la rete. Quello che hai già aperto resta sul
        telefono; il resto aspetta.
      </p>

      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          Resta disponibile
        </h2>
        <ul className="mt-2 list-none space-y-2 p-0 text-sm text-[var(--text-secondary)]">
          <li>La mappa che hai già visto</li>
          <li>I campi che hai aperto</li>
        </ul>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Se non hai ancora aperto nessun campo, la mappa resta vuota finché
          non torni online.
        </p>
      </div>

      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          Non disponibile
        </h2>
        <ul className="mt-2 list-none space-y-2 p-0 text-sm text-[var(--text-secondary)]">
          <li>Check-in</li>
          <li>Lobby</li>
          <li>Segnalazioni</li>
        </ul>
      </div>

      <OfflineRetry />
    </main>
  );
}
