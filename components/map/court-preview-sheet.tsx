"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { sportDisplayLabel, surfaceTypeLabel } from "@/lib/courts/search";

/**
 * Anteprima di un campo dalla mappa (#43).
 *
 * Sostituisce la navigazione dura: il tap su un punto apre questo sheet e la
 * mappa resta com'era (camera, marker, dati). L'utente puo' chiudere e
 * continuare a esplorare, oppure passare al dettaglio con navigazione client.
 *
 * Il Drawer di progetto fornisce role="dialog", focus trap, Escape, tap sul
 * backdrop e il blocco dello scroll. Alla chiusura il focus torna alla mappa
 * (`finalFocus`), non al punto toccato: il canvas non ha un nodo per campo.
 */
export interface CourtPreview {
  id: string;
  name: string;
  address?: string | null;
  sport?: string | null;
  surface_type?: string | null;
  photo_path?: string | null;
}

interface CourtPreviewSheetProps {
  open: boolean;
  court: CourtPreview | null;
  lobbyCount: number;
  reported: boolean;
  favorite: boolean;
  onClose: () => void;
  /** Focus di ritorno alla chiusura: la regione mappa. */
  finalFocus?: React.RefObject<HTMLElement | null>;
}

export function CourtPreviewSheet({
  open,
  court,
  lobbyCount,
  reported,
  favorite,
  onClose,
  finalFocus,
}: CourtPreviewSheetProps) {
  // Alla chiusura il contenuto resta per l'animazione di uscita del Drawer.
  const lastCourt = React.useRef<CourtPreview | null>(null);
  if (court) lastCourt.current = court;
  const shown = court ?? lastCourt.current;
  const titleId = React.useId();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  if (!shown) return null;

  const sport = sportDisplayLabel(shown.sport);
  const surface = surfaceTypeLabel(shown.surface_type);
  const lobbyText =
    lobbyCount <= 0
      ? "Nessuna lobby attiva"
      : `${lobbyCount} ${lobbyCount === 1 ? "lobby attiva" : "lobby attive"}`;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      initialFocus={headingRef}
      finalFocus={finalFocus}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CourtPhotoThumb photoPath={shown.photo_path} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)] focus:outline-none"
            >
              {shown.name}
            </h2>
            {shown.address && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {shown.address}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="accent">{sport}</Badge>
              {surface && <Badge variant="default">{surface}</Badge>}
              {favorite && <Badge variant="default">Salvato</Badge>}
              {reported && <Badge variant="danger">Segnalato</Badge>}
            </div>
          </div>
        </div>

        <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {lobbyText}
        </p>

        {reported && (
          <p className="text-sm text-[var(--danger-dark)]">
            C&apos;è una segnalazione attiva su questo campo: controlla prima di
            andare.
          </p>
        )}

        <div className="space-y-2 pt-1">
          <Link
            href={`/courts/${shown.id}`}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-control bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)] transition-all duration-150 hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            Apri dettaglio
          </Link>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
