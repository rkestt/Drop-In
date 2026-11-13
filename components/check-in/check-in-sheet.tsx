"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("check-in");
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { LoginModal } from "@/components/auth/login-modal";
import { StepTransition } from "@/components/motion/step-transition";
import { SuccessPop } from "@/components/motion/success-pop";
import { CheckoutButton } from "@/components/check-in/checkout-button";
import { MapPin, Navigation, AlertTriangle, Clock } from "lucide-react";
import {
  CHECK_IN_MAX_ACCURACY_M,
  CHECK_IN_RADIUS_M,
  expiryFromCheckin,
  formatExpiry,
  fromAccuracy,
  fromGeolocationCode,
  fromInsertError,
  isCheckinActive,
  outOfRangeError,
  parseDistanceMeters,
  type CheckInErrorInfo,
} from "@/lib/checkin/errors";
import { classifyOutboxError } from "@/lib/offline/outbox";
import { enqueue } from "@/lib/offline/outbox-store";

export interface ActiveCheckIn {
  id: string;
  checkedInAt: string;
}

interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  courtLat: number;
  courtLng: number;
  activeCheckIn?: ActiveCheckIn | null;
  /** Calcolato dal server: true solo con NEXT_PUBLIC_ALLOW_MOCK_GPS=true in sviluppo. */
  mockGps?: boolean;
}

type SheetState =
  | "idle"
  | "loading"
  | "error"
  | "inside"
  | "success";

/**
 * Mock ammesso solo con flag esplicita e mai in produzione.
 *
 * Il flag è calcolato dal Server Component (`page.tsx`) e passato come prop:
 * nel client non compare mai il nome della variabile, e in produzione la prop
 * è sempre `false` (verifica con `grep ALLOW_MOCK_GPS .next/static`).
 * Quando attivo, la UI dichiara "Posizione simulata".
 */
function readPosition(mockGps: boolean): Promise<GeolocationPosition> {
  if (mockGps) {
    // Posizione simulata: il trigger DB a 50 m resta l'unica validazione.
    return Promise.resolve({
      coords: {
        latitude: 0,
        longitude: 0,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition);
  }
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function CheckInSheet({
  open,
  onClose,
  courtId,
  courtName,
  courtLat,
  courtLng,
  activeCheckIn = null,
  mockGps = false,
}: CheckInSheetProps) {
  const [state, setState] = useState<SheetState>("idle");
  const [error, setError] = useState<CheckInErrorInfo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    // Scaduto = come se non ci fosse: si torna a idle e si può rifare
    // il check-in subito, senza vicoli ciechi.
    if (activeCheckIn && isCheckinActive(activeCheckIn.checkedInAt)) {
      setState("inside");
      setSince(formatExpiry(new Date(activeCheckIn.checkedInAt)));
      setExpiresAt(formatExpiry(expiryFromCheckin(activeCheckIn.checkedInAt)));
      setError(null);
    } else {
      // Defer reset fuori dal body dell'effect: evita render a cascata.
      queueMicrotask(() => {
        setState("idle");
        setError(null);
        setExpiresAt(null);
        setSince(null);
        setGpsAccuracy(null);
      });
    }
  }, [open, activeCheckIn]);

  const queueCheckIn = (
    userId: string,
    lat: number,
    lng: number,
    accuracy: number,
  ) => {
    // Offline o rete caduta a metà: coordinate già calcolate in coda, il
    // trigger distanza le rivalida al replay. Chiude la scheda, niente errore.
    enqueue("check_in", {
      user_id: userId,
      court_id: courtId,
      lat,
      lng,
      accuracy,
      status: "active",
    });
    onClose();
    toast("Check-in in coda: lo inviamo appena torni online.");
  };

  const handleCheckIn = async () => {
    setState("loading");
    setError(null);

    // Coordinate note fin qui: servono al catch per accodare un insert
    // mai partito (rete caduta dopo il GPS).
    let userId: string | null = null;
    let coords: { latitude: number; longitude: number; accuracy: number } | null =
      null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Senza sessione non si mostra un errore generico: si apre il login.
        // Al ritorno l'utente ritrova la scheda e tocca "Fai check-in".
        setState("idle");
        setShowLogin(true);
        return;
      }

      const position = await readPosition(mockGps);
      // Con il mock la posizione è quella del campo: mai courtLat/courtLng
      // al posto del GPS quando il mock è disattivo.
      const latitude = mockGps ? courtLat : position.coords.latitude;
      const longitude = mockGps ? courtLng : position.coords.longitude;
      const { accuracy } = position.coords;
      setGpsAccuracy(accuracy);
      userId = user.id;
      coords = { latitude, longitude, accuracy };

      const accuracyError = fromAccuracy(accuracy);
      if (accuracyError) {
        setError(accuracyError);
        setState("error");
        return;
      }

      // Nessun successo ottimistico: confermato solo dopo l'insert.
      // La distanza la valida il trigger DB a 50 m, non il client.
      // Offline: niente insert, si accoda con le coordinate calcolate.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueCheckIn(user.id, latitude, longitude, accuracy);
        return;
      }
      const { error: insertError } = await supabase.from("check_ins").insert({
        user_id: user.id,
        court_id: courtId,
        lat: latitude,
        lng: longitude,
        accuracy,
        status: "active",
      });

      if (insertError) {
        // Rete caduta durante l'insert: errore transient → in coda, come se
        // fossimo offline. Duplicate/permanent restano errore inline.
        const raw = insertError.code
          ? `${insertError.code} ${insertError.message}`
          : insertError.message;
        if (classifyOutboxError(raw) === "transient") {
          queueCheckIn(user.id, latitude, longitude, accuracy);
          return;
        }
        // Il messaggio del trigger porta già i metri: nessun ricalcolo.
        if (/troppo lontano/i.test(insertError.message)) {
          setError(
            outOfRangeError(parseDistanceMeters(insertError.message).meters)
          );
        } else {
          setError(fromInsertError(insertError.message));
        }
        setState("error");
        return;
      }

      log.info("check-in ok", { courtId, userId: user.id });
      // Scadenza = ora check-in + 2h (auto-checkout pg_cron), it-IT.
      const expiry = expiryFromCheckin(new Date());
      setExpiresAt(formatExpiry(expiry));
      setSince(formatExpiry(new Date()));
      setState("success");
      toast.success(
        `Check-in attivo fino alle ${formatExpiry(expiry)}.`
      );
    } catch (err) {
      const geoErr = err as GeolocationPositionError & { message?: string };
      if (typeof geoErr.code === "number") {
        setError(fromGeolocationCode(geoErr.code));
      } else if (
        userId !== null &&
        coords !== null &&
        classifyOutboxError(geoErr.message ?? null) === "transient"
      ) {
        // Insert mai partito (fetch rifiutata): coordinate valide già in mano,
        // si accoda invece di mostrare un errore.
        queueCheckIn(userId, coords.latitude, coords.longitude, coords.accuracy);
        return;
      } else {
        setError(fromInsertError(geoErr.message ?? "Errore durante il check-in."));
      }
      setState("error");
    }
  };

  const stepKey =
    state === "success" ? "done" : state === "inside" ? "inside" : state === "error" ? "error" : "form";

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Check-in">
      {/* Entrata/uscita del drawer restano quelle di Base UI: qui dentro si
          scambia solo il contenuto, senza animazioni custom sul contenitore. */}
      <StepTransition stepKey={stepKey}>
        {state === "success" && expiresAt ? (
          <div className="space-y-4">
            <SuccessPop
              title="Check-in attivo"
              description={`Check-in attivo fino alle ${expiresAt}. Sei dentro per 2 ore. Puoi fare check-out dalla scheda del campo quando vuoi.`}
            />
            <Button onClick={onClose} className="w-full">
              Chiudi
            </Button>
          </div>
        ) : state === "inside" && activeCheckIn ? (
          <div className="space-y-4">
            <div className="rounded-card border border-[var(--border)] border-s-2 border-s-[var(--success)] bg-[var(--bg-surface)] p-4">
              <p
                className="text-base text-[var(--text-primary)]"
                role="status"
                aria-live="polite"
              >
                Sei qui dalle <strong>{since}</strong>, check-in attivo fino
                alle <strong>{expiresAt}</strong>.
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Il check-in si chiude da solo alle {expiresAt}. Fai check-out
                se te ne vai prima.
              </p>
            </div>
            <CheckoutButton checkInId={activeCheckIn.id} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {courtName}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Devi essere entro {CHECK_IN_RADIUS_M} m dal campo
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
              <Clock
                className="h-5 w-5 shrink-0 text-[var(--accent)]"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Check-in aperto ora
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                  Resta attivo 2 ore, poi si chiude da solo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-card border border-dashed border-[var(--border-strong)] p-3.5">
              <Navigation
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"
                aria-hidden="true"
              />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Serve il GPS: ti verifichiamo entro {CHECK_IN_RADIUS_M} m dal
                campo.
              </p>
            </div>

            {mockGps && (
              <p
                className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm text-[var(--warning)]"
                role="note"
              >
                Posizione simulata: attiva solo in sviluppo.
              </p>
            )}

            {gpsAccuracy !== null &&
              gpsAccuracy > 0 &&
              gpsAccuracy <= CHECK_IN_MAX_ACCURACY_M && (
              <div className="flex items-center gap-2 text-sm text-[var(--success)]">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Precisione GPS: {Math.round(gpsAccuracy)} m
              </div>
            )}

            {state === "loading" && (
              <p className="text-sm text-[var(--text-secondary)]" role="status" aria-live="polite">
                Controlliamo che tu sia entro {CHECK_IN_RADIUS_M} m dal campo.
                Ci vuole qualche secondo.
              </p>
            )}

            {state === "error" && error && (
              <div
                className="space-y-1 rounded-card border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  {error.title}
                </p>
                <p className="text-sm text-[var(--text-primary)]">{error.body}</p>
                {error.hint && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {error.hint}
                  </p>
                )}
                {error.kind === "denied" && (
                  <details className="rounded-control border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                    <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-2 px-3.5 font-semibold text-[var(--text-primary)]">
                      Come fare
                    </summary>
                    <div className="px-3.5 pb-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                      <ol className="list-decimal space-y-1.5 ps-4">
                        <li>Apri le Impostazioni del telefono.</li>
                        <li>Cerca Drop-In e apri la voce Posizione.</li>
                        <li>Scegli «Consenti» e torna qui.</li>
                      </ol>
                      <p className="mt-2.5">Poi tocca Riprova.</p>
                    </div>
                  </details>
                )}
                {error.kind === "low-accuracy" && gpsAccuracy !== null && (
                  <p className="flex items-center gap-2 text-sm text-[var(--warning)]">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Precisione GPS scarsa: {Math.round(gpsAccuracy)} m
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={
                  state === "error" && error?.kind === "auth"
                    ? () => setShowLogin(true)
                    : state === "error" &&
                        error?.kind === "court-not-approved"
                      ? onClose
                      : handleCheckIn
                }
                disabled={state === "loading"}
                aria-busy={state === "loading"}
                className="w-full"
              >
                {state === "loading"
                  ? "Verifica posizione…"
                  : state === "error" && error
                    ? error.retryLabel
                    : "Fai check-in"}
              </Button>
              {state === "idle" && (
                <Button onClick={onClose} variant="secondary" className="w-full">
                  Annulla
                </Button>
              )}
            </div>
          </div>
        )}
      </StepTransition>
      </Drawer>
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
