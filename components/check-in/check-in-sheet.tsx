"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MapPin, Navigation, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CheckInSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  courtLat: number;
  courtLng: number;
}

const CHECK_IN_RADIUS = 50; // meters
const SKIP_GPS = process.env.NEXT_PUBLIC_SKIP_GPS_CHECK === "true";

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CheckInSheet({
  open,
  onClose,
  courtId,
  courtName,
  courtLat,
  courtLng,
}: CheckInSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccess(false);
      setGpsAccuracy(null);
    }
  }, [open]);

  const handleCheckIn = async () => {
    console.error("[check-in] handleCheckIn called, SKIP_GPS=", SKIP_GPS, "courtId=", courtId);
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error("[check-in] Auth error:", authError);
        throw new Error("Errore di autenticazione. Riprova.");
      }

      const user = authData?.user;

      if (!user) {
        throw new Error("Devi effettuare l'accesso per fare check-in.");
      }

      let latitude: number;
      let longitude: number;
      let accuracy: number;

      if (SKIP_GPS) {
        // Dev mode: use court coordinates (distance = 0, trigger always passes)
        latitude = courtLat;
        longitude = courtLng;
        accuracy = 0;
      } else {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        accuracy = position.coords.accuracy;
      }
      setGpsAccuracy(accuracy);

      const distance = haversineDistance(latitude, longitude, courtLat, courtLng);

      if (distance > CHECK_IN_RADIUS) {
        throw new Error(
          `Sei troppo lontano dal campo (${Math.round(distance)}m). Avvicinati per fare check-in.`
        );
      }

      // Find active lobby the user participates in at this court
      let lobbyId: string | null = null;
      const { data: participantLobbies } = await supabase
        .from("lobby_participants")
        .select("lobby_id")
        .eq("user_id", user.id);

      const lobbyIds = participantLobbies?.map((p) => p.lobby_id) ?? [];
      if (lobbyIds.length > 0) {
        const { data: activeLobby } = await supabase
          .from("lobbies")
          .select("id")
          .in("id", lobbyIds)
          .eq("court_id", courtId)
          .in("status", ["open", "in_progress"])
          .order("start_time", { ascending: true })
          .limit(1)
          .single();

        if (activeLobby) {
          lobbyId = activeLobby.id;
        }
      }

      const { error: insertError } = await supabase.from("check_ins").insert({
        user_id: user.id,
        court_id: courtId,
        lobby_id: lobbyId,
        lat: latitude,
        lng: longitude,
        accuracy,
        status: "active",
      });

      if (insertError) {
        console.error("[check-in] Insert error:", insertError);
        const msg = insertError.message.toLowerCase();
        // Italian trigger messages
        if (msg.includes("lontano") || msg.includes("distanza")) {
          throw new Error("Sei troppo lontano dal campo. Avvicinati per fare check-in.");
        }
        if (msg.includes("5 minuti") || msg.includes("attendere")) {
          throw new Error("Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo.");
        }
        throw new Error(insertError.message || "Errore durante il check-in.");
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("[check-in] Unexpected error:", err);
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
    <BottomSheet open={open} onClose={onClose} title="Check-in">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[var(--accent)] mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-[var(--text-primary)]">{courtName}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {SKIP_GPS
                ? "GPS bypassato (dev mode) — check-in sempre consentito"
                : `Devi essere entro ${CHECK_IN_RADIUS}m dal campo`}
            </p>
          </div>
        </div>

        {!SKIP_GPS && gpsAccuracy !== null && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Navigation className="w-4 h-4" />
            Precisione GPS: {Math.round(gpsAccuracy)}m
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

        {success && (
          <div
            className="p-3 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm animate-scale-in"
            role="status"
            aria-live="polite"
          >
            Check-in effettuato con successo!
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
    </BottomSheet>
  );
}
