// Candidati dedup di submit-court-form (#55).
// La RPC `dedup_candidates` maschera `id` (NULL) per i campi in revisione:
// la riga resta visibile (nome/distanza) ma senza navigazione al dettaglio.

export interface DedupCandidateRef {
  id: string | null;
}

// Chiave React stabile: i masked rows hanno tutti `id` NULL, quindi
// l'indice di fallback evita chiavi duplicate (`key={candidate.id}`).
export function dedupCandidateKey(candidate: DedupCandidateRef, index: number): string {
  return candidate.id ?? `pending-${index}`;
}

// Vera solo quando esiste un dettaglio navigabile (`/courts/<id>`).
export function canNavigateToCandidate(candidate: DedupCandidateRef): boolean {
  return typeof candidate.id === "string" && candidate.id.length > 0;
}
