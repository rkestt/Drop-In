"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, SquareArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INSTALL_DISMISS_KEY,
  isIosDevice,
  isStandaloneDisplayMode,
  readDismissedAt,
  shouldShowInstallPrompt,
} from "@/lib/pwa/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

function readStoredDismissedAt(): number | null {
  try {
    if (typeof window === "undefined") return null;
    return readDismissedAt(window.localStorage.getItem(INSTALL_DISMISS_KEY));
  } catch {
    return null;
  }
}

function persistDismissedAt(now: number): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(now));
  } catch {
    // Storage pieno o bloccato (Safari privato): la chiusura resta valida
    // per la sessione corrente.
  }
}

function isStandaloneNow(): boolean {
  try {
    if (
      typeof window.matchMedia === "function" &&
      isStandaloneDisplayMode(
        window.matchMedia("(display-mode: standalone)").matches,
      )
    ) {
      return true;
    }
  } catch {
    // matchMedia non disponibile: si continua con il fallback iOS.
  }
  try {
    return (
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * Banner compatto di installazione PWA, nel flusso della pagina (non un
 * modal, non fixed): sta sopra la bottom nav / a fine pagina senza coprire
 * il contenuto. Appare solo quando il browser emette `beforeinstallprompt`
 * (Chrome/Edge/Android) oppure su iOS non standalone con le istruzioni
 * manuali (iOS non ha `beforeinstallprompt`).
 */
export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIos, setShowIos] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    // Decisione di mount attraverso il predicato testato: il deferred prompt
    // arriva dopo via evento (qui si assume disponibile), quindi a mount il
    // seam decide su standalone + dismissal — stessa condizione di prima.
    if (
      !shouldShowInstallPrompt({
        hasDeferredPrompt: true,
        dismissedAt: readStoredDismissedAt(),
        now: Date.now(),
        isStandalone: isStandaloneNow(),
      })
    )
      return;

    let ua = "";
    try {
      ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    } catch {
      ua = "";
    }
    if (isIosDevice(ua)) {
      setShowIos(true);
      return;
    }

    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferred(e);
    };
    const onInstalled = () => {
      persistDismissedAt(Date.now());
      deferredRef.current = null;
      setDeferred(null);
      setShowIos(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    persistDismissedAt(Date.now());
    deferredRef.current = null;
    setDeferred(null);
    setShowIos(false);
  }, []);

  const install = useCallback(async () => {
    const event = deferredRef.current;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // prompt() può rifiutare se l'utente chiude il dialogo: in ogni caso
      // non si ripropone subito.
    }
    persistDismissedAt(Date.now());
    deferredRef.current = null;
    setDeferred(null);
  }, []);

  if (!mounted) return null;
  if (!deferred && !showIos) return null;

  return (
    // Wrapper: il banner vive dopo {children} nel body, quindi senza gabbia
    // sarebbe a filo schermo e attaccato alla bottom nav. Stessa larghezza
    // massima e stessi 16px di gutters del resto dell'app; il padding
    // verticale lo stacca dal bordo e dalla nav (la safe area la gestisce
    // già la nav).
    <div className="mx-auto w-full max-w-[720px] px-4 pb-4 pt-4">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Download
            className="h-4 w-4 shrink-0 text-[var(--accent)]"
            aria-hidden="true"
          />
          Installa Drop-In
        </p>
        {deferred ? (
          <>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Aggiungila alla home: si apre più in fretta e funziona anche
              offline.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={install}>
                Installa
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Non ora
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* iOS: nessun prompt di sistema, quindi il testo sono le
                istruzioni. L'icona è quella del foglio di condivisione di
                Safari, così il passaggio si riconosce a colpo d'occhio. */}
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Tocca{" "}
              <span className="font-medium text-[var(--text-primary)]">
                <SquareArrowUp
                  className="mr-1 inline-block h-4 w-4 align-middle"
                  aria-hidden="true"
                />
                Condividi
              </span>
              , poi{" "}
              <span className="font-medium text-[var(--text-primary)]">
                Aggiungi a Home
              </span>
              .
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Non ora
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
