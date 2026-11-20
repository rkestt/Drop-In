import { cache } from "react";
import type { createClient } from "@/lib/supabase/server";

// Gate età #97: stato minimo per decidere il redirect, una query sola.
// RLS (`profile_age_select`) lascia leggere solo la propria riga, quindi
// `maybeSingle` sulla chiave utente basta: niente query pesanti per render.
export type AgeGateStatus = {
  /** `null` = anonimo (browse-first: nessun redirect, mai). */
  userId: string | null;
  /** Riga `profile_age` presente = età già verificata. */
  verified: boolean;
};

export async function getAgeGateStatus(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AgeGateStatus> {
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return { userId: null, verified: false };
  }
  if (!userId) return { userId: null, verified: false };
  try {
    const { data, error } = await supabase
      .from("profile_age")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    // Errore di rete/DB: fail closed (redirect come se non verificato).
    // È un gate legale: meglio un verificato bloccato a riprovare che un
    // non verificato dentro in silenzio. Onesto sul rimbalzo: se l'INSERT
    // riesce ma la lettura dopo fallisce, l'utente torna al gate e il nuovo
    // invio è un no-op (upsert idempotente nel client) che rimanda a "/"
    // senza mostrare errori — ma il bounce / ↔ gate persiste finché le
    // letture non tornano. "Niente loop" vale solo per i redirect di questa
    // pagina (anonimo o già verificato → "/"), non per quel caso.
    if (error || !data) return { userId, verified: false };
    return { userId, verified: true };
  } catch {
    return { userId, verified: false };
  }
}

// Una query in meno per navigazione quando più server component dello
// stesso request leggono lo stato (layout + pagina): memoizzato per
// request, zero rischio (stessi argomenti → stesso risultato).
export const getCachedAgeGateStatus = cache(getAgeGateStatus);
