// Bozza del form submit-court in sessionStorage (#75).
//
// La chiave resta `submit-court-draft-v1`: i draft scritti prima del campo
// posizione manuale hanno la vecchia forma (`location` con accuracy). Il
// decoder li riporta al nuovo modello invece di scartarli, così un reload
// (es. fotocamera su Android) non perde il lavoro fatto.

import { SPORTS, type Sport } from "@/lib/sport/sports";
import {
  clampAddressInput,
  isValidLatitude,
  isValidLongitude,
  type CourtPosition,
} from "./position";

/** Chiave storica: non cambiarla o i draft già scritti diventano invisibili. */
export const SUBMIT_COURT_DRAFT_KEY = "submit-court-draft-v1";

export interface SubmitCourtDraft {
  name: string;
  selectedSport: Sport | null;
  surface: string;
  position: CourtPosition | null;
  address: string;
  dedupConfirmed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Legge una posizione da entrambe le forme:
 * - nuova: `{ source: "gps" | "manual", lat, lng, accuracy? }`
 * - vecchia: `{ lat, lng, accuracy }` (senza `source`, sempre GPS)
 *
 * Una posizione GPS senza accuracy valida viene scartata: meglio nessuna
 * posizione che una posizione con precisione inventata.
 */
function readPosition(value: unknown): CourtPosition | null {
  if (!isRecord(value)) return null;
  const { lat, lng, accuracy, source } = value;
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;

  if (source === "manual") {
    return { source: "manual", lat, lng };
  }

  const gpsShape = source === "gps" || source === undefined;
  if (
    gpsShape &&
    typeof accuracy === "number" &&
    Number.isFinite(accuracy) &&
    accuracy >= 0
  ) {
    return { source: "gps", lat, lng, accuracy };
  }

  return null;
}

export function encodeSubmitCourtDraft(draft: SubmitCourtDraft): string {
  return JSON.stringify({
    name: draft.name,
    selectedSport: draft.selectedSport,
    surface: draft.surface,
    position: draft.position,
    address: clampAddressInput(draft.address),
    dedupConfirmed: draft.dedupConfirmed,
  });
}

/**
 * Decodifica tollerante: JSON corrotto o forma sconosciuta → null (form
 * vuoto). Campi singoli invalidi vengono scartati senza buttare il resto.
 */
export function decodeSubmitCourtDraft(raw: string | null): SubmitCourtDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const sport =
    typeof parsed.selectedSport === "string" &&
    SPORTS.some((option) => option.value === parsed.selectedSport)
      ? (parsed.selectedSport as Sport)
      : null;

  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    selectedSport: sport,
    surface: typeof parsed.surface === "string" ? parsed.surface : "",
    // `position` è la forma nuova; `location` quella scritta prima di #75.
    position: readPosition(parsed.position) ?? readPosition(parsed.location),
    address: typeof parsed.address === "string" ? clampAddressInput(parsed.address) : "",
    dedupConfirmed: parsed.dedupConfirmed === true,
  };
}
