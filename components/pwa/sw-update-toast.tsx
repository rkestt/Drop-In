"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Toast di aggiornamento del service worker. Non registra nulla di nuovo:
 * ascolta il service worker esistente. `app/sw.ts` usa `skipWaiting: true`
 * + `clientsClaim: true`, quindi un update si attiva subito e il
 * `controllerchange` scatta sulla pagina aperta.
 *
 * Idempotente (un solo toast per caricamento) e mai un lancio se i service
 * worker non sono disponibili.
 */
export function SwUpdateToast() {
  const shownRef = useRef(false);

  useEffect(() => {
    try {
      if (
        typeof navigator === "undefined" ||
        !("serviceWorker" in navigator) ||
        !navigator.serviceWorker
      ) {
        return;
      }
      // Al primo caricamento in assoluto non c'è ancora un controller: il
      // controllerchange che segue l'attivazione iniziale non è un update.
      const hadControllerAtLoad = navigator.serviceWorker.controller !== null;
      if (!hadControllerAtLoad) return;

      const onControllerChange = () => {
        if (shownRef.current) return;
        shownRef.current = true;
        toast("Nuova versione attiva", {
          id: "sw-update",
          description: "Ricarica per usare l'ultima versione.",
          action: {
            label: "Ricarica",
            onClick: () => window.location.reload(),
          },
        });
      };
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
      return () => {
        try {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            onControllerChange,
          );
        } catch {
          // Cleanup best-effort: lo smontaggio non deve mai lanciare.
        }
      };
    } catch {
      return;
    }
  }, []);

  return null;
}
