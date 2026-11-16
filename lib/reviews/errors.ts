/**
 * Codici PostgREST delle recensioni (#34) -> messaggio italiano generico.
 * Il testo grezzo di Supabase non arriva mai in UI: è tecnico e in inglese.
 */

export function reviewErrorMessage(code: string | null | undefined): string {
  switch (code) {
    // La corte non e' piu' approvata, o la riga non e' dell'utente.
    case "42501":
      return "Non possiamo salvare la recensione su questo campo.";
    // Duplicato: con l'upsert non dovrebbe succedere, ma la UI non mente.
    case "23505":
      return "Hai già recensito questo campo: aggiorna la tua recensione.";
    // Check del DB (rating 1..5, body 1..500): errore nostro, non dell'utente.
    case "23514":
      return "Controlla la valutazione: deve essere da 1 a 5 stelle.";
    default:
      return "Salvataggio non riuscito. Riprova.";
  }
}
