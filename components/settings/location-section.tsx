"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, MapPin, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type GeoState = "checking" | "prompt" | "granted" | "denied" | "unsupported";

const DESC_OK = "Serve per la mappa, il check-in entro 50 m e le lobby vicine.";
const DESC_DENIED =
  "Senza posizione non possiamo mostrarti i campi vicini né verificare il check-in.";

/**
 * "Posizione" section. Reads the permission via `navigator.permissions`
 * (guarded: Safari has no `geolocation` entry in Permissions, and private
 * mode can throw) with a `navigator.geolocation` presence fallback —
 * nothing here may crash. "Riprova" triggers a short-timeout
 * `getCurrentPosition` and updates the state; coordinates are never stored.
 */
export function LocationSection() {
  const [state, setState] = useState<GeoState>("checking");
  const [liveMessage, setLiveMessage] = useState("");
  const mountedRef = useRef(true);

  const applyPermissionState = useCallback(
    (permission: PermissionState | null) => {
      if (!mountedRef.current) return;
      if (permission === "granted") {
        setState("granted");
      } else if (permission === "denied") {
        setState("denied");
      } else {
        // "prompt" or unknown (incl. Safari fallback): askable.
        setState("prompt");
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    let permissionStatus: PermissionStatus | null = null;
    const onChange = () => {
      if (permissionStatus) applyPermissionState(permissionStatus.state);
    };

    const resolve = async () => {
      try {
        if (
          typeof navigator === "undefined" ||
          !("geolocation" in navigator) ||
          typeof navigator.geolocation === "undefined"
        ) {
          if (mountedRef.current) setState("unsupported");
          return;
        }
        const permissions = (
          navigator as Navigator & {
            permissions?: { query(o: { name: string }): Promise<PermissionStatus> };
          }
        ).permissions;
        if (!permissions || typeof permissions.query !== "function") {
          if (mountedRef.current) setState("prompt");
          return;
        }
        permissionStatus = await permissions.query({ name: "geolocation" });
      } catch {
        // Safari (<16: no "geolocation" in Permissions) and locked-down
        // contexts throw: fall back to "askable", never crash.
        if (mountedRef.current) setState("prompt");
        return;
      }
      if (!mountedRef.current) return;
      applyPermissionState(permissionStatus.state);
      try {
        permissionStatus.addEventListener("change", onChange);
      } catch {
        // `onchange` assignment fallback for older WebKit.
        try {
          permissionStatus.onchange = onChange;
        } catch {
          // Non-fatal: the state just won't live-update.
        }
      }
    };

    void resolve();
    return () => {
      mountedRef.current = false;
      try {
        permissionStatus?.removeEventListener("change", onChange);
      } catch {
        // Ignore cleanup errors on exotic PermissionStatus objects.
      }
    };
  }, [applyPermissionState]);

  const retry = () => {
    let settled = false;
    const finish = (next: GeoState, message: string) => {
      if (settled) return;
      settled = true;
      setState(next);
      setLiveMessage(message);
    };
    try {
      if (
        typeof navigator === "undefined" ||
        !("geolocation" in navigator) ||
        typeof navigator.geolocation?.getCurrentPosition !== "function"
      ) {
        finish(
          "unsupported",
          "Questo browser non supporta la geolocalizzazione."
        );
        return;
      }
      setState("checking");
      navigator.geolocation.getCurrentPosition(
        () =>
          finish(
            "granted",
            "Posizione consentita. Ora puoi fare check-in."
          ),
        (error) => {
          // PERMISSION_DENIED = 1. Timeouts / unavailable positions leave
          // the state askable instead of alarming the user.
          if (error && error.code === 1) {
            finish(
              "denied",
              "Posizione negata. Segui le istruzioni per riattivarla."
            );
          } else {
            finish("prompt", DESC_OK);
          }
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    } catch {
      finish("prompt", DESC_OK);
    }
  };

  return (
    <section aria-labelledby="settings-posizione">
      <div className="flex items-center gap-2">
        <MapPin
          className="w-4 h-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <h2
          id="settings-posizione"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Posizione
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div
        className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4"
        aria-busy={state === "checking"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Posizione
          </h3>
          {state === "checking" ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-6 w-24 animate-pulse rounded-chip bg-[var(--bg-elevated)]"
              />
              <span className="sr-only">
                Controllo del permesso di posizione…
              </span>
            </>
          ) : (
            <Badge
              variant={state === "granted" ? "success" : state === "denied" ? "danger" : "default"}
            >
              {state === "granted"
                ? "Consentita"
                : state === "denied"
                  ? "Negata"
                  : state === "unsupported"
                    ? "Non supportata"
                    : "Da chiedere"}
            </Badge>
          )}
        </div>

        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {state === "denied" ? DESC_DENIED : DESC_OK}
        </p>

        {state === "granted" && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
            <Lock className="w-4 h-4 flex-none" aria-hidden="true" />
            Non salviamo le tue coordinate.
          </p>
        )}

        {state === "unsupported" && (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Questo browser non supporta la geolocalizzazione: potrai comunque
            usare l’app, ma senza campi vicini e check-in automatico.
          </p>
        )}

        {(state === "prompt" || state === "checking") && (
          <div className="mt-3 flex flex-col items-start gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={retry}
              disabled={state === "checking"}
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              {state === "checking" ? "Controllo…" : "Consenti posizione"}
            </Button>
            {state === "prompt" && (
              <span className="text-[13px] text-[var(--text-muted)]">
                Il telefono ti chiederà il permesso.
              </span>
            )}
          </div>
        )}

        {state === "denied" && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
              Come riattivarla
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
              <li>
                <strong className="font-semibold text-[var(--text-secondary)]">
                  Safari.
                </strong>{" "}
                Impostazioni del telefono › Privacy e sicurezza ›
                Localizzazione › Safari › “Durante l’uso”.
              </li>
              <li>
                <strong className="font-semibold text-[var(--text-secondary)]">
                  Chrome.
                </strong>{" "}
                Lucchetto accanto all’indirizzo › Autorizzazioni › Posizione ›
                Consenti.
              </li>
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={retry}
              className="mt-3"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Riprova
            </Button>
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </section>
  );
}
