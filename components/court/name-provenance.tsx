"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LoginModal } from "@/components/auth/login-modal";
import { ProposeNameSheet } from "./propose-name-sheet";

interface NameProvenanceProps {
  courtId: string;
  courtName: string;
  /** Solo con `isAutoName` il blocco esiste: il nome vero non ha chip. */
  isAutoName: boolean;
  signedIn: boolean;
  /** Motivo del blocco (ban/karma): presente = nessun controllo, solo testo. */
  blockedReason: string | null;
  /** Nome della proposta pending dell'utente, se ne ha una su questo campo. */
  ownPendingName: string | null;
  /** Da `?proponi=nome`: apre il form una volta, poi ripulisce l'URL. */
  initialOpen: boolean;
}

/**
 * Zona identità del campo (ticket 106, superficie 1): chip "Nome automatico" +
 * una riga di azione/stato. Non è una card: riga senza bordo né sfondo,
 * chip a sinistra e azione a capo quando non c'è spazio (360px).
 *
 * - Nome vero (`isAutoName` falso): nulla, zero pixel.
 * - Bloccato: testo, nessun bottone morto.
 * - Proposta propria in attesa: link a «Le tue proposte» (`/submit-court#nomi`).
 * - Invito: apre il form (loggato) o il login (gate d'ingresso, mai a metà).
 */
export function NameProvenance({
  courtId,
  courtName,
  isAutoName,
  signedIn,
  blockedReason,
  ownPendingName,
  initialOpen,
}: NameProvenanceProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // Dopo l'invio la riga passa subito a "in attesa" senza refetch.
  const [justProposed, setJustProposed] = useState<string | null>(null);
  // `?proponi=nome` si consuma una volta sola, come il drawer lobby.
  const [deepLink, setDeepLink] = useState(initialOpen);
  useEffect(() => {
    if (!initialOpen) return;
    window.history.replaceState(null, "", `/courts/${courtId}`);
  }, [initialOpen, courtId]);

  const pendingName = justProposed ?? ownPendingName;
  const canPropose = signedIn && blockedReason == null && pendingName == null;

  // Deep link valido solo con accesso e senza stati che chiudono il form:
  // altrimenti la scheda mostra il suo stato e il form non si apre.
  useEffect(() => {
    if (!deepLink) return;
    setDeepLink(false);
    if (!isAutoName) return;
    if (canPropose) {
      setSheetOpen(true);
    } else if (!signedIn) {
      setLoginOpen(true);
    }
  }, [deepLink, canPropose, signedIn, isAutoName]);

  if (!isAutoName) return null;

  const loginNext = `/courts/${courtId}?proponi=nome`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
        <Badge variant="default">Nome automatico</Badge>
        {blockedReason != null ? (
          <p className="inline-flex min-h-[44px] items-center text-sm text-[var(--text-secondary)]">
            Non puoi proporre un nome adesso.
          </p>
        ) : pendingName != null ? (
          <Link
            href="/submit-court#nomi"
            aria-label={`Proposta in attesa: ${pendingName}. Vedi le tue proposte`}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded"
          >
            <Clock className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="break-words">
              Proposta in attesa: «{pendingName}»
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          </Link>
        ) : signedIn ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`Proponi il nome vero per ${courtName}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-0 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded"
          >
            <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
            Proponi il nome vero
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              aria-describedby="name-provenance-login-hint"
              aria-label={`Proponi il nome vero per ${courtName}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 px-0 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded"
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
              Proponi il nome vero
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </button>
            <span id="name-provenance-login-hint" className="sr-only">
              Accedi per proporre un nome
            </span>
          </>
        )}
      </div>
      {blockedReason != null && (
        <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
          {blockedReason}
        </p>
      )}

      {signedIn ? (
        <ProposeNameSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          courtId={courtId}
          courtName={courtName}
          ownPendingName={pendingName}
          onProposed={(name) => setJustProposed(name)}
        />
      ) : (
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          next={loginNext}
        />
      )}
    </div>
  );
}
