"use client";

import { SportChipGroup } from "@/components/sport/sport-chip-group";

/**
 * Primo passo del primo avvio: scelta dello sport attivo.
 *
 * Il passo non ha stato proprio né un "Salva": la scelta scrive subito nel
 * `SportContext` (chiave `sport`), quindi la CTA serve solo ad avanzare e
 * chiudere il drawer lascia lo sport selezionato. Non toccato = default
 * Basket, che è anche il default di `fromStorage` (`null` non è scritto).
 *
 * Il testo è passato al drawer come `aria-describedby` (`bodyId`), il gruppo
 * come `aria-labelledby` del titolo del passo (`titleId`).
 */
export function SportStep({
  bodyId,
  titleId,
}: {
  /** Id del paragrafo che descrive il passo. */
  bodyId: string;
  /** Id del titolo del passo (nomina il radiogroup). */
  titleId: string;
}) {
  return (
    <>
      <p
        id={bodyId}
        className="m-0 mb-3 text-sm leading-relaxed text-[var(--text-secondary)]"
      >
        La mappa si apre sul tuo sport. Puoi cambiarlo quando vuoi da
        Impostazioni.
      </p>
      <SportChipGroup labelledBy={titleId} className="mb-5" />
    </>
  );
}
