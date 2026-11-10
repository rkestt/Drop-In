"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("check-in");
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { StepTransition } from "@/components/motion/step-transition";
import { SuccessPop } from "@/components/motion/success-pop";
import { MapPin, Navigation, AlertTriangle } from "lucide-react";

interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  courtLat: number;
  courtLng: number;
}

const CHECK_IN_RADIUS = 50; // meters
const MAX_ACCURACY = 20; // meters

export function CheckInSheet({
  open,
  onClose,
  courtId,
  courtName,
  /* eslint-disable @typescript-eslint/no-unused-vars */
  courtLat,
  courtLng,
  /* eslint-enable @typescript-eslint/no-unused-vars */
}: CheckInSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!open) {
      // Defer state reset outside synchronous effect body to avoid cascading renders
      queueMicrotask(() => {
        setError(null);
        setSuccess(false);
        setExpiresAt(null);
        setGpsAccuracy(null);
      });
    }
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Devi effettuare l'accesso per fare check-in.");
      }

      // Get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      setGpsAccuracy(accuracy);

      if (accuracy > MAX_ACCURACY) {
        throw new Error(
          `Precisione GPS scarsa (${Math.round(accuracy)}m). Avvicinati al centro del campo.`
        );
      }

      // Server-side distance validation via RPC or insert with trigger
      // For MVP, we validate client-side and trust the server to enforce via trigger
      const { error: insertError } = await supabase.from("check_ins").insert({
        user_id: user.id,
        court_id: courtId,
        lat: latitude,
        lng: longitude,
        accuracy,
        status: "active",
      });

      if (insertError) {
        if (insertError.message.includes("distance")) {
          throw new Error("Sei troppo lontano dal campo. Avvicinati per fare check-in.");
        }
        throw insertError;
      }

      log.info("check-in ok", { courtId, userId: user.id });
      // L'auto-checkout scatta dopo 2h: la scadenza è parte dell'esito,
      // non un dettaglio che appare dopo.
      setExpiresAt(
        new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setSuccess(true);
      // Stesso pattern di create-lobby-drawer: il timer si cancella su
      // chiusura/unmount, così onClose scatta una volta sola.
      closeTimer.current = window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const geoErr = err as GeolocationPositionError & { message?: string };
      if (geoErr.code === 1) {
        setError("Permesso di geolocalizzazione negato. Abilita GPS per fare check-in.");
      } else if (geoErr.code === 2) {
        setError("Posizione non disponibile. Verifica che il GPS sia attivo.");
      } else if (geoErr.code === 3) {
        setError("Timeout GPS. Riprova.");
      } else {
        setError(geoErr.message || "Errore durante il check-in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Check-in">
      {/* Entrata/uscita del drawer restano quelle di Base UI: qui dentro si
          scambia solo il contenuto (form -> esito), senza animazioni custom
          sul contenitore. */}
      <StepTransition stepKey={success ? "done" : "form"}>
        {success ? (
          <SuccessPop
            title="Check-in effettuato"
            description={
              expiresAt
                ? `Check-in attivo fino alle ${expiresAt}.`
                : "Check-in attivo."
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[var(--accent)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--text-primary)]">{courtName}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Devi essere entro {CHECK_IN_RADIUS}m dal campo
                </p>
              </div>
            </div>

            {gpsAccuracy !== null && gpsAccuracy <= MAX_ACCURACY && (
              <div className="flex items-center gap-2 text-sm text-[var(--success)]">
                <Navigation className="w-4 h-4" />
                Precisione GPS: {Math.round(gpsAccuracy)}m
              </div>
            )}

            {gpsAccuracy !== null && gpsAccuracy > MAX_ACCURACY && (
              <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
                <AlertTriangle className="w-4 h-4" />
                Precisione GPS scarsa: {Math.round(gpsAccuracy)}m
              </div>
            )}

            {error && (
              <div
                className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm animate-scale-in"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <Button
              onClick={handleCheckIn}
              disabled={loading || success}
              className="w-full"
            >
              {loading ? "Verifica posizione..." : success ? "Check-in OK" : "Check-in"}
            </Button>
          </div>
        )}
      </StepTransition>
    </Drawer>
  );
}
