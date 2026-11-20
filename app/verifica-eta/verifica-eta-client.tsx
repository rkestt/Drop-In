"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgeGate } from "@/components/age-gate/age-gate";
import { isAtLeast14, parseBirthDate } from "@/lib/profile/age";
import { createClient } from "@/lib/supabase/client";

// Messaggi del gate (#97): il blocco parla di 14 anni, mai generico.
// Stesso testo per il rifiuto client e per il backstop DB (23514).
const UNDERAGE_MESSAGE =
  "Devi avere almeno 14 anni per usare Drop-In: con questa data non puoi entrare.";
const INVALID_MESSAGE =
  "La data di nascita non è valida: controlla giorno, mese e anno.";
const NETWORK_MESSAGE = "Qualcosa è andato storto: riprova.";
const DELETE_FAILED_MESSAGE = "Cancellazione non riuscita: riprova.";
// 409 dal gate: le lobby non sono raggiungibili da /verifica-eta, quindi il
// messaggio del server (che pensa alle pagine lobby) va specializzato coi
// passi nell'ordine giusto: prima entrare, poi cancellare, poi eliminare.
const DELETE_BLOCKED_LOBBIES_MESSAGE =
  "Hai ancora partite future con altri iscritti. Dichiara un'età valida, entra, cancella quelle lobby e poi elimina l'account.";

/**
 * Wrapper client di /verifica-eta: collega `AgeGate` (puro) al server.
 * Salva con upsert idempotente col client dell'utente su `profile_age`
 * (RLS own-row, niente service role); sotto i 14 anni o data non valida non scrive nulla e alza
 * `blocked`. La cancellazione riusa POST /api/account/delete (#94).
 */
export function VerificaEtaClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const handleSubmit = (date: string) => {
    // Idempotente, non "niente finestra": due tap nello stesso frame chiamano
    // `onSubmit` due volte (il guard `pending` di AgeGate legge una prop
    // stale) e due tab possono correre insieme. L'upsert sulla own-row rende
    // la seconda scrittura un no-op: mai un 23505 mostrato come errore per
    // una verifica in realtà riuscita. Stessa ragione per il rimbalzo
    // / → gate → submit → /: se l'INSERT è riuscito ma la lettura dopo è
    // fallita, il reinvio ritrova la riga e rimanda a "/" senza errori.
    setPending(true);
    setError(null);

    // Filtro client: sotto i 14 o non valida → mai scrittura, solo blocco.
    const parsed = parseBirthDate(date);
    if (parsed === null) {
      setError(INVALID_MESSAGE);
      setPending(false);
      return;
    }
    if (!isAtLeast14(parsed)) {
      setBlocked(true);
      setError(UNDERAGE_MESSAGE);
      setPending(false);
      return;
    }

    void (async () => {
      try {
        const supabase = createClient();
        const { error: saveError } = await supabase
          .from("profile_age")
          .upsert(
            { user_id: userId, birth_date: parsed },
            { onConflict: "user_id" }
          );
        if (saveError) {
          // Backstop DB: i CHECK di 056/057 rifiutano con 23514 — stesso
          // messaggio del filtro client, non un errore generico.
          if (saveError.code === "23514") {
            setBlocked(true);
            setError(UNDERAGE_MESSAGE);
          } else {
            setError(NETWORK_MESSAGE);
          }
          setPending(false);
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        setError(NETWORK_MESSAGE);
        setPending(false);
      }
    })();
  };

  const handleDeleteAccount = () => {
    setPending(true);
    setDeleteError(null);
    void (async () => {
      try {
        const res = await fetch("/api/account/delete", { method: "POST" });
        if (res.ok) {
          // Sessione revocata dal delete: pulizia locale, poi home da anon.
          await createClient().auth.signOut();
          router.replace("/");
          router.refresh();
          return;
        }
        if (res.status === 409) {
          // Dal gate le lobby non sono raggiungibili: niente testo del
          // server, i passi nell'ordine giusto.
          setDeleteError(DELETE_BLOCKED_LOBBIES_MESSAGE);
          setPending(false);
          return;
        }
        let message = DELETE_FAILED_MESSAGE;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // Corpo non JSON: resta il messaggio di default.
        }
        setDeleteError(message);
        setPending(false);
      } catch {
        setDeleteError(DELETE_FAILED_MESSAGE);
        setPending(false);
      }
    })();
  };

  return (
    <AgeGate
      pending={pending}
      error={error}
      deleteError={deleteError}
      blocked={blocked}
      onSubmit={handleSubmit}
      onDeleteAccount={handleDeleteAccount}
    />
  );
}
