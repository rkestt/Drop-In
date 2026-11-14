"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  clipboardText,
  courtShareContent,
  lobbyShareContent,
  shareUrl,
} from "@/lib/share/links";
import { cn } from "@/lib/utils";

/**
 * Condivisione deep link di un campo o una lobby (#35).
 *
 * Web Share API quando c'è (`navigator.share`), altrimenti copia nella
 * clipboard con toast di conferma ("Link copiato"). Annullamento utente
 * (`AbortError`): silenzio, mai un errore. Target 44px, solo token di
 * design, mai colori hardcoded né `dark:`.
 */
export function ShareButton({
  path,
  subject,
  name,
  when,
  showLabel = false,
}: {
  /** Path relativo da condividere (`/courts/{id}` o `/lobbies/{id}`). */
  path: string;
  /** Cosa si condivide: guida nome accessibile e testi. */
  subject: "court" | "lobby";
  /** Nome del campo (titolo e testo dell'invito). */
  name: string;
  /** Etichetta data/ora della lobby, già in ora di Roma (solo lobby). */
  when?: string;
  /** Variante con etichetta visibile "Condividi", altrimenti solo icona. */
  showLabel?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const accessibleName =
    subject === "court" ? "Condividi questo campo" : "Condividi questa lobby";

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const content =
        subject === "court"
          ? courtShareContent(name)
          : lobbyShareContent(name, when ?? "");
      const url = shareUrl(
        path,
        typeof window !== "undefined" ? window.location.origin : undefined,
      );
      // `navigator.share` è facoltativo: accesso difensivo, niente
      // narrowing su `"share" in navigator` (i tipi DOM lo danno sempre
      // presente e il ramo else diventerebbe `never`).
      const nav =
        typeof navigator !== "undefined"
          ? (navigator as Navigator & {
              share?: (data: ShareData) => Promise<void>;
            })
          : undefined;
      if (nav?.share) {
        try {
          await nav.share({ title: content.title, text: content.text, url });
        } catch (err) {
          // Annullata dall'utente: silenzio. Solo gli altri errori avvisano.
          if (err instanceof DOMException && err.name === "AbortError") return;
          toast.error("Condivisione non riuscita");
        }
        return;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(clipboardText({ ...content, url }));
        toast("Link copiato");
      } else {
        toast.error("Copia non riuscita");
      }
    } catch {
      toast.error("Copia non riuscita");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={busy}
      aria-label={accessibleName}
      title={accessibleName}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-[var(--border)] bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:opacity-50",
        showLabel ? "min-w-11 px-4 text-sm" : "h-11 w-11",
      )}
    >
      <Share2 className="h-5 w-5" aria-hidden="true" />
      {showLabel && <span>Condividi</span>}
    </button>
  );
}
