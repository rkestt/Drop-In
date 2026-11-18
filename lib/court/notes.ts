// Note di campo (#90): mapper puri riga -> voce UI + fetch mirato per
// l'anteprima mappa.
//
// La query della scheda vive in `app/(app)/courts/[id]/page.tsx` (additiva,
// try/catch proprio), il client calcola solo la nota appena aggiunta
// (`adesso`). L'anteprima mappa si apre solo dopo aver recuperato la nota
// (`fetchPreviewNote`, con tetto breve): il foglio non deve mai allungarsi
// dopo l'apertura. Stessa impostazione di `lib/court/name-proposals.ts` e
// `lib/moderation/queue.ts`: tutto unit-testabile, niente mismatch di
// idratazione (le età della scheda arrivano già formattate dal server).

import type { SupabaseClient } from "@supabase/supabase-js";
import { postgrestErrorFields } from "@/lib/lobbies/join-errors";
import { queueDateLabel } from "@/lib/moderation/queue";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Soglia di freschezza (decisione 1 della spec): una nota è fresca se ha al
 * massimo 30 giorni. Regola di presentazione, non vincolo DB: vive qui,
 * non in un CHECK (come le durate per sport in `lib/sport/sports.ts`).
 */
export const COURT_NOTE_STALE_DAYS = 30;

/** Tetto del body: stesso del CHECK di `court_notes` (053). */
export const NOTE_BODY_MAX = 200;

/** Righe visibili prima del fold (decisione 4 della spec). */
export const COURT_NOTES_VISIBLE_MAX = 3;

/** Gli slug DB (053): valori di dato in inglese, etichette italiane in app. */
export const NOTE_KINDS = [
  "broken_hoop",
  "closed",
  "private_area",
  "no_lighting",
  "surface",
  "other",
] as const;

export type CourtNoteKind = (typeof NOTE_KINDS)[number];

const KIND_LABELS: Record<CourtNoteKind, string> = {
  broken_hoop: "Canestro rotto",
  closed: "Chiuso",
  private_area: "Area privata",
  no_lighting: "Illuminazione assente",
  surface: "Superficie rovinata",
  other: "Altro",
};

/** Slug DB -> etichetta italiana; `""` quando il valore è ignoto. */
export function noteKindLabel(kind: string | null | undefined): string {
  if (kind == null) return "";
  return (KIND_LABELS as Record<string, string>)[kind] ?? "";
}

/** Vera quando il tipo è uno dei sei noti (il DB ne garantisce altri). */
export function isKnownNoteKind(kind: string | null | undefined): boolean {
  return kind != null && kind in KIND_LABELS;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Vera quando la nota è fresca (al massimo `COURT_NOTE_STALE_DAYS` giorni).
 * Una data futura (clock skew) conta come fresca, come `submittedAgoLabel`
 * che la chiama "adesso" invece di produrre numeri negativi.
 */
export function isFreshNote(
  createdAt: string | Date,
  now: string | Date = new Date(),
): boolean {
  const created = new Date(createdAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(created) || Number.isNaN(current)) return false;
  return current - created <= COURT_NOTE_STALE_DAYS * DAY_MS;
}

/**
 * Età umana di una nota ("2 settimane fa"). `now` iniettabile per i test.
 * Differisce da `submittedAgoLabel` (che oltre 7 giorni passa alla data):
 * la testa della card dice "l'ultima è di 4 mesi fa", e le righe mostrano
 * "2 settimane fa" — con l'altra funzione quelle etichette non esisterebbero.
 */
export function noteAgeLabel(
  createdAt: string | Date,
  now: string | Date = new Date(),
): string {
  const created = new Date(createdAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(created) || Number.isNaN(current)) return "";
  const diff = current - created;

  if (diff < MINUTE_MS) return "adesso";
  if (diff < HOUR_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return minutes === 1 ? "1 minuto fa" : `${minutes} minuti fa`;
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? "1 ora fa" : `${hours} ore fa`;
  }
  const days = Math.floor(diff / DAY_MS);
  if (days < 14) {
    return days === 1 ? "1 giorno fa" : `${days} giorni fa`;
  }
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 settimana fa" : `${weeks} settimane fa`;
  }
  if (days < 365) {
    // Mai "12 mesi": oltre l'anno si parla di anni.
    const months = Math.min(11, Math.floor(days / 30));
    return months <= 1 ? "1 mese fa" : `${months} mesi fa`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 anno fa" : `${years} anni fa`;
}

/** Riga grezza di `court_notes` per la scheda campo. */
export interface CourtNoteRow {
  id: string;
  kind: string;
  body: string | null;
  created_at: string;
}

/** Riga pronta per la card: etichette già formattate, niente calcoli in UI. */
export interface CourtNoteItem {
  id: string;
  kind: CourtNoteKind;
  kindLabel: string;
  /** Testo della nota, oppure `null` quando non c'è. */
  body: string | null;
  /** Età relativa ("2 settimane fa", "adesso" per la nota appena aggiunta). */
  ageLabel: string;
  /** Data esatta ("4 nov 2026", `queueDateLabel`: un solo formattatore). */
  dateLabel: string;
  /** ISO originale, per `<time dateTime>`. */
  dateTime: string;
  /** Falsa oltre `COURT_NOTE_STALE_DAYS` giorni: attenuata, mai nascosta. */
  fresh: boolean;
}

/**
 * Riga grezza -> voce da mostrare, oppure `null` quando il tipo è ignoto o
 * la data non è leggibile: il chiamante scarta le null, invece di spacciare
 * una nota per un'altra (stessa regola di `mapMyNameProposal`).
 */
export function mapCourtNote(
  row: CourtNoteRow,
  now: string | Date = new Date(),
): CourtNoteItem | null {
  if (!isKnownNoteKind(row.kind)) return null;
  const created = new Date(row.created_at).getTime();
  if (Number.isNaN(created)) return null;
  const kind = row.kind as CourtNoteKind;
  const body = row.body?.trim() ? row.body : null;
  return {
    id: row.id,
    kind,
    kindLabel: KIND_LABELS[kind],
    body,
    ageLabel: noteAgeLabel(row.created_at, now),
    dateLabel: queueDateLabel(row.created_at),
    dateTime: row.created_at,
    fresh: isFreshNote(row.created_at, now),
  };
}

/** Partizione della card: fresche sopra, precedenti sotto il confine. */
export interface NotesSplit {
  /** Tutte le fresche (più nuove prima), anche oltre il massimo visibile. */
  fresh: CourtNoteItem[];
  /** Tutte le vecchie (più nuove prima). */
  stale: CourtNoteItem[];
  /** Le prime `COURT_NOTES_VISIBLE_MAX` righe, a fold chiuso. */
  visible: CourtNoteItem[];
  /** Il resto, dietro il fold. */
  hidden: CourtNoteItem[];
  /** Il numero del fold ("Mostra le altre N note"). */
  hiddenCount: number;
  /**
   * Vera quando nel visibile convivono fresche e vecchie: solo allora il
   * separatore `Precedenti` ha senso (a fold aperto sta tra i due gruppi).
   */
  showSeparator: boolean;
}

/**
 * Lista già ordinata (più nuove prima) -> partizione. L'ordinamento per data
 * rende la partizione un prefisso/suffisso: le fresche stanno sempre sopra.
 */
export function splitCourtNotes(
  items: CourtNoteItem[],
  visibleMax: number = COURT_NOTES_VISIBLE_MAX,
): NotesSplit {
  const fresh = items.filter((item) => item.fresh);
  const stale = items.filter((item) => !item.fresh);
  const visible = items.slice(0, visibleMax);
  const hidden = items.slice(visibleMax);
  const showSeparator =
    visible.some((item) => item.fresh) && visible.some((item) => !item.fresh);
  return { fresh, stale, visible, hidden, hiddenCount: hidden.length, showSeparator };
}

/**
 * La riga di testa della card. Compare solo quando aggiunge informazione:
 * con la più recente fresca l'età è già sulla prima riga; con zero note la
 * card ha il suo testo dedicato. `null` = nessuna riga.
 */
export function courtNotesHeadline(items: CourtNoteItem[]): string | null {
  if (items.length === 0) return null;
  const newest = items[0];
  if (newest.fresh) return null;
  if (newest.ageLabel === "") return null;
  return `Nessuna nota recente: l'ultima è di ${newest.ageLabel}.`;
}

/**
 * Vera quando il separatore `Precedenti` va prima della riga `index`: la
 * riga è vecchia e quella sopra è fresca. Il confine è temporale, non
 * dipendente dal fold: vale uguale a fold chiuso (sulla lista visibile) e
 * a fold aperto (sull'elenco intero). Lista già ordinata, più nuove prima.
 */
export function courtNoteSeparatorBefore(
  items: CourtNoteItem[],
  index: number,
): boolean {
  const note = items[index];
  if (!note || note.fresh) return false;
  const prev = index > 0 ? items[index - 1] : null;
  return prev != null && prev.fresh;
}

/** Nota pronta per l'anteprima mappa: tipo ed età già in italiano. */
export interface PreviewCourtNote {
  kind: string;
  age: string;
}

/**
 * La nota più recente di un campo per l'anteprima mappa (`limit 1`), oppure
 * `null` quando non c'è, non è fresca, ha un tipo ignoto o la query fallisce.
 * Mai un throw: la riga è additiva, l'anteprima resta anche senza nota.
 */
export async function fetchPreviewNote(
  supabase: SupabaseClient<Database>,
  courtId: string,
): Promise<PreviewCourtNote | null> {
  try {
    const { data, error } = await supabase
      .from("court_notes")
      .select("kind,created_at")
      .eq("court_id", courtId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    if (!isFreshNote(data.created_at)) return null;
    const kind = noteKindLabel(data.kind);
    if (!kind) return null;
    const age = noteAgeLabel(data.created_at);
    if (!age) return null;
    return { kind, age };
  } catch {
    return null;
  }
}

export interface AddNoteErrorInfo {
  message: string;
  /** Falso quando riprovare non può funzionare (la UI nasconde "Riprova"). */
  canRetry: boolean;
}

const TRANSIENT_RE =
  /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|(?<!\d)5\d\d(?!\d)|econn|enotfound|socket/i;

/**
 * Errori di `add_court_note` in italiano (ticket #77: mai raw in UI).
 * La RPC parla già italiano per bannato/karma/campo non approvato e per le
 * validazioni (P0001): quelli passano così come sono. Rete e fallimenti
 * generici usano il testo della spec (`Non siamo riusciti ad aggiungere la
 * nota.` + `Il testo è ancora qui.` + `Riprova` nel drawer): il mapper
 * distingue solo "Riprova sì / no" via `canRetry`.
 */
export function mapAddNoteError(err: unknown): AddNoteErrorInfo {
  const { code, message } = postgrestErrorFields(err);
  const raw = `${code ?? ""} ${message ?? ""}`.trim();
  if (code === "42501") {
    return { message: "Non puoi aggiungere note a questo campo.", canRetry: false };
  }
  if (code === "P0001") {
    return {
      message:
        message.trim() !== ""
          ? message
          : "Non siamo riusciti ad aggiungere la nota.",
      canRetry: false,
    };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return {
      message: "Non siamo riusciti ad aggiungere la nota.",
      canRetry: true,
    };
  }
  return {
    message: "Non siamo riusciti ad aggiungere la nota.",
    canRetry: false,
  };
}
