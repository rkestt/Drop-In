export interface PostgrestErrorFields {
  code: string | null;
  message: string;
}

/**
 * Campi `code`/`message` da un errore PostgREST, in qualunque forma arrivi
 * (issue 103): con `shouldThrowOnError: false` (default del client browser)
 * `supabase.from(...).insert()` non lancia — restituisce `{ error }` come
 * oggetto semplice `{ code, message, details, hint }`, non un'istanza di
 * `Error`. Chi faceva `err instanceof Error ? err.message : ""` scartava
 * quindi sempre codice e messaggio. Legge entrambi da `Error` (con `.code`
 * extra di PostgREST) e da oggetto semplice, senza perdere la `string`.
 */
export function postgrestErrorFields(err: unknown): PostgrestErrorFields {
  if (err === null || err === undefined) return { code: null, message: "" };
  if (typeof err === "string") return { code: null, message: err };
  if (typeof err !== "object") return { code: null, message: String(err) };
  const rec = err as Record<string, unknown>;
  const message = typeof rec.message === "string" ? rec.message : "";
  const code = typeof rec.code === "string" ? rec.code : null;
  return { code, message };
}
