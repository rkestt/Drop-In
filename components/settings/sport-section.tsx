import { Dumbbell } from "lucide-react";
import { SportChipGroup } from "@/components/sport/sport-chip-group";

/**
 * "Sport" section: la stessa scelta del primo passo dell'onboarding, per
 * cambiarla dopo. Nessuno stato locale, nessun "Salva": la griglia scrive
 * subito nello `SportContext` (chiave `sport`).
 *
 * Server component: l'unica parte client è il gruppo di chip.
 */
export function SportSection() {
  return (
    <section aria-labelledby="settings-sport">
      <div className="flex items-center gap-2">
        <Dumbbell
          className="w-4 h-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <h2
          id="settings-sport"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Sport
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <p className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          La mappa e le lobby vicine seguono questa scelta.
        </p>
        <SportChipGroup labelledBy="settings-sport" />
      </div>
    </section>
  );
}
