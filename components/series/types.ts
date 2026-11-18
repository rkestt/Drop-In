import type { SeriesWithNextOccurrence } from "@/lib/series/types";

/**
 * Riga di "Le mie serie" (#92, superficie 2): la serie con la prossima
 * occorrenza già letta dalle righe `lobbies` reali, più i due campi del campo
 * che la UI deve mostrare senza altre query (nome e "campo non attivo").
 *
 * Modulo senza direttiva: lo importano il Server Component della pagina
 * (che risolve i nomi) e i Client Component della lista.
 */
export interface SeriesListItem extends SeriesWithNextOccurrence {
  /** Nome del campo (`"Campo"` se illeggibile, mai vuoto). */
  courtName: string;
  /** `false` = `courts.status` non `active`: niente nuove partite. */
  courtActive: boolean;
}
