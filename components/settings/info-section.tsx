import { Info } from "lucide-react";
import { APP_VERSION } from "@/lib/app-info";

/**
 * "Informazioni" section (server): version, map attribution, font licence.
 * No dead links: privacy/report rows from the prototype are omitted until
 * their destinations exist (see Resolution in the d18 ticket).
 */
export function InfoSection() {
  return (
    <section aria-labelledby="settings-info">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h2
          id="settings-info"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Informazioni
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            Versione
          </span>
          <span className="ms-auto text-sm text-[var(--text-secondary)]">
            {APP_VERSION}
          </span>
        </div>
      </div>

      <div className="mt-2 px-1 text-xs leading-relaxed text-[var(--text-muted)]">
        <p>
          Dati mappa ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            OpenStreetMap contributors
          </a>
          .
        </p>
        <p>Tile © OpenFreeMap. Stile © OpenMapTiles.</p>
        <p>Font: Syne e Source Sans 3, licenza OFL.</p>
      </div>
    </section>
  );
}
