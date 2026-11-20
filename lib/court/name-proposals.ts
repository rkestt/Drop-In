// Proposte di nome proprie (ticket 106): mapping puro riga -> voce.
// Nessun DOM, nessuna fetch: unit-testabile in isolation.

import { postgrestErrorFields } from "@/lib/lobbies/join-errors";
import { formatSubmissionDate } from "./my-submissions";

/**
 * Riga grezza di `court_name_proposals` con il nome attuale della corte
 * (join `courts`). La RLS mostra al proponente solo le proprie righe.
 */
export interface MyNameProposalRow {
  id: string;
  court_id: string;
  proposed_name: string;
  status: string | null;
  moderator_note: string | null;
  created_at: string;
  courts?: { name: string | null } | Array<{ name: string | null }> | null;
}

/** Gli stati della tabella (CHECK del DB, 051). */
export type NameProposalStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** Riga pronta per la UI: etichette leggibili, niente logica di fetch. */
export interface MyNameProposalItem {
  id: string;
  /** Nome proposto dal giocatore. */
  proposedName: string;
  /** Stato normalizzato (righe con stato ignoto scartate dal mapper). */
  status: NameProposalStatus;
  /** "In revisione" | "Accettata" | "Rifiutata" | "Ritirata". */
  statusLabel: string;
  /** Variante del Badge: accent | success | danger | default. */
  badgeVariant: "accent" | "success" | "danger" | "default";
  /** Vera solo per le proposte ancora in attesa (ritiro possibile). */
  pending: boolean;
  /** Nome attuale del campo ("per «…»"). */
  currentName: string | null;
  /** Data di invio ("16 nov 2026"). */
  dateLabel: string;
  /** Nota del moderatore; valorizzata solo sulle rifiutate. */
  moderationNote: string | null;
}

function currentNameOf(
  row: MyNameProposalRow,
): string | null {
  const joined = row.courts;
  const value = Array.isArray(joined) ? joined[0]?.name : joined?.name;
  return value?.trim() ? value.trim() : null;
}

/** "pending" -> "In revisione", "approved" -> "Accettata", ecc. */
export function nameProposalStatusLabel(
  status: string | null | undefined,
): string {
  if (status === "pending") return "In revisione";
  if (status === "approved") return "Accettata";
  if (status === "rejected") return "Rifiutata";
  if (status === "withdrawn") return "Ritirata";
  return "";
}

function badgeFor(
  status: NameProposalStatus,
): MyNameProposalItem["badgeVariant"] {
  if (status === "pending") return "accent";
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "default";
}

/**
 * Riga grezza -> voce da mostrare, oppure `null` quando lo stato non è tra
 * quelli noti: il chiamante scarta le null, invece di spacciarle per
 * "pending" (coercizione silenziosa).
 */
export function mapMyNameProposal(
  row: MyNameProposalRow,
): MyNameProposalItem | null {
  if (
    row.status !== "pending" &&
    row.status !== "approved" &&
    row.status !== "rejected" &&
    row.status !== "withdrawn"
  ) {
    return null;
  }
  return {
    id: row.id,
    proposedName: row.proposed_name,
    status: row.status,
    statusLabel: nameProposalStatusLabel(row.status),
    badgeVariant: badgeFor(row.status),
    pending: row.status === "pending",
    currentName: currentNameOf(row),
    dateLabel: formatSubmissionDate(row.created_at),
    moderationNote: row.moderator_note ?? null,
  };
}

/**
 * Normalizzazione per il confronto "uguale all'attuale": trim + spazi
 * interni collassati + case-insensitive (decisione di spec, superficie 2).
 */
export function normalizeCourtName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Vera quando il nome proposto coincide con quello attuale del campo. */
export function isSameCourtName(proposed: string, current: string): boolean {
  return normalizeCourtName(proposed) === normalizeCourtName(current);
}

export interface ProposeNameErrorInfo {
  message: string;
  /** Vera quando il client DEVE riprovare (rete); falso altrimenti. */
  canRetry: boolean;
}

const BANNED_RE = /bannato|banned/i;
const KARMA_RE = /karma/i;
const APPROVED_ONLY_RE = /approvati/i;
const OWNED_RE = /uguale a quello attuale/i;
const OPEN_RE = /già una proposta in attesa|attendi un minuto/i;
// Doppio tab o race che batte l'indice unico parziale: il DB risponde
// 23505 con inglese raw, non con il P0001 italiano del trigger.
const DUPLICATE_RE = /23505|duplicate key/i;
const RATE_RE = /troppe proposte|limite giornaliero|too many|rate.?limit/i;
const TRANSIENT_RE =
  /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|(?<!\d)5\d\d(?!\d)|econn|enotfound|socket/i;

/**
 * Errori di `propose_court_name` in italiano (ticket 77: mai raw Postgres in UI).
 * Il trigger parla già italiano per bannato/karma/campo non approvato:
 * quelli passano così come sono. P0001 di validazione passa il testo del
 * server (già italiano); il resto ha un fallback generico non riprovabile,
 * la rete resta riprovabile.
 */
export function mapProposeNameError(err: unknown): ProposeNameErrorInfo {
  const { code, message } = postgrestErrorFields(err);
  const raw = `${code ?? ""} ${message ?? ""}`.trim();
  if (raw !== "" && BANNED_RE.test(raw)) {
    return { message, canRetry: false };
  }
  if (raw !== "" && KARMA_RE.test(raw)) {
    return { message, canRetry: false };
  }
  if (raw !== "" && APPROVED_ONLY_RE.test(raw)) {
    return { message, canRetry: false };
  }
  if (raw !== "" && OWNED_RE.test(raw)) {
    return { message: "È già il nome di questo campo.", canRetry: false };
  }
  if (raw !== "" && (OPEN_RE.test(raw) || DUPLICATE_RE.test(raw))) {
    return {
      message:
        "Hai già una proposta in attesa su questo campo: la trovi in «Le tue proposte».",
      canRetry: false,
    };
  }
  if (raw !== "" && RATE_RE.test(raw)) {
    return { message, canRetry: false };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return {
      message: "Connessione assente: controlla la rete e riprova.",
      canRetry: true,
    };
  }
  if (code === "P0001" && message.trim() !== "") {
    return { message, canRetry: false };
  }
  if (code === "42501") {
    return { message: "Accedi per proporre un nome.", canRetry: false };
  }
  return {
    message: "Non siamo riusciti a inviare la proposta.",
    canRetry: false,
  };
}
