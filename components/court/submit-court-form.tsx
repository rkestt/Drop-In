"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  submitCourtSchema,
  type SubmitCourtValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { useSport } from "@/lib/sport/sport-context";
import { SPORTS } from "@/lib/sport/sports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadCourtPhoto, deleteCourtPhoto } from "@/lib/storage/court-photos";
import { dedupCandidateKey, canNavigateToCandidate } from "@/lib/court/dedup-candidate";
import {
  ADDRESS_MAX,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  clampAddressInput,
  formatCoordinateValue,
  formatCoordinates,
  parseCoordinate,
  sanitizeAddress,
  type CourtPosition,
  type PositionSource,
} from "@/lib/court/position";
import {
  SUBMIT_COURT_DRAFT_KEY,
  decodeSubmitCourtDraft,
  encodeSubmitCourtDraft,
  type SubmitCourtDraft,
} from "@/lib/court/submit-draft";
import { ROME_CENTER } from "@/lib/lobbies/nearby";
import {
  MapPin,
  Camera,
  X,
  AlertTriangle,
  Navigation,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// Il picker trascina MapLibre: chunk separato, caricato solo quando l'utente
// sceglie la modalità manuale. L'alternativa accessibile (coordinate) è già
// nel form, la mappa non è necessaria per inviare.
const LocationPicker = dynamic(
  () => import("@/components/court/location-picker").then((m) => ({ default: m.LocationPicker })),
  { ssr: false, loading: () => <LocationPickerLoading /> }
);

interface DedupCandidate {
  // NULL per i campi in revisione (riga mascherata dalla RPC dedup, 018).
  id: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  moderation_status: string;
  source: string;
}

interface SubmitCourtFormProps {
  onLoginRequired: () => void;
}

const SURFACE_OPTIONS = [
  { value: "", label: "Non specificata" },
  { value: "asphalt", label: "Asfalto" },
  { value: "concrete", label: "Cemento" },
  { value: "wood", label: "Legno" },
  { value: "grass", label: "Erba" },
  { value: "rubber", label: "Gomma" },
  { value: "tartan", label: "Tartan" },
];

const POSITION_MODES: { value: PositionSource; label: string }[] = [
  { value: "gps", label: "GPS" },
  { value: "manual", label: "Sulla mappa" },
];

const LOCATION_ACCURACY_THRESHOLD = 100; // meters
const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // rifiuto esplicito pre-elaborazione
// Dedup: con il pin trascinato o le coordinate digitate la posizione cambia
// a raffica. Il controllo parte quando l'utente si ferma, non a ogni tasto.
const DEDUP_DEBOUNCE_MS = 400;

export function SubmitCourtForm({ onLoginRequired }: SubmitCourtFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { sport } = useSport();

  const [user, setUser] = useState<{ id: string } | null>(null);

  // Testo del form in react-hook-form (schema zod = unica fonte).
  // Restano useState solo per: file foto, posizione, loading, errori di
  // rete/DB, successo.
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<SubmitCourtValues>({
    resolver: zodResolver(submitCourtSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      sport: sport ?? "basketball",
      surface: "",
      hasPhoto: false,
    },
  });
  const draftName = watch("name");
  const draftSport = watch("sport");
  const draftSurface = watch("surface");

  // Una sola posizione, con la fonte esplicita: "gps" porta l'accuratezza,
  // "manual" no (mai un numero inventato per far contento il tipo).
  const [position, setPosition] = useState<CourtPosition | null>(null);
  const [positionMode, setPositionMode] = useState<PositionSource>("gps");
  // Testo grezzo degli input: serve a mostrare quello che l'utente scrive
  // anche quando non è ancora una coordinata valida.
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordsTouched, setCoordsTouched] = useState(false);
  // true se le coordinate sono state digitate a mano: al submit si rilegge
  // il testo, non ci si fida di un valore intermedio rimasto in `position`.
  const [coordsEdited, setCoordsEdited] = useState(false);
  const [address, setAddress] = useState("");
  const [positionAnnouncement, setPositionAnnouncement] = useState("");

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dedupCandidates, setDedupCandidates] = useState<DedupCandidate[] | null>(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupConfirmed, setDedupConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dettaglio tecnico (name: message) visibile solo in sviluppo: da telefono
  // non si apre la console, e senza questo l'errore reale resta mascherato.
  const [debugDetail, setDebugDetail] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const gpsPanelRef = useRef<HTMLDivElement>(null);
  const manualPanelRef = useRef<HTMLDivElement>(null);
  const shouldFocusModePanel = useRef(false);
  const nameId = useId();
  const sportId = useId();
  const surfaceId = useId();
  const photoId = useId();
  const latId = useId();
  const lngId = useId();
  const addressId = useId();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id });
      }
    });
  }, [supabase]);

  useEffect(() => {
    if (sport) {
      setValue("sport", sport);
    }
  }, [sport, setValue]);

  // Ripristino bozza dopo un reload (es. fotocamera su Android). Dichiarato
  // DOPO la sincronizzazione con lo sport globale così al mount vince la
  // bozza; i cambi successivi di sport continuano a sincronizzarsi.
  // `decodeSubmitCourtDraft` accetta anche la forma vecchia (`location` +
  // accuracy): i draft scritti prima di #75 non vanno persi.
  useEffect(() => {
    try {
      const draft = decodeSubmitCourtDraft(
        sessionStorage.getItem(SUBMIT_COURT_DRAFT_KEY)
      );
      if (!draft) return;
      setValue("name", draft.name);
      if (draft.selectedSport) setValue("sport", draft.selectedSport);
      setValue("surface", draft.surface);
      if (draft.address) setAddress(draft.address);
      if (draft.position) {
        setPosition(draft.position);
        if (draft.position.source === "manual") {
          setPositionMode("manual");
          setLatInput(formatCoordinateValue(draft.position.lat));
          setLngInput(formatCoordinateValue(draft.position.lng));
        } else {
          setPositionMode("gps");
        }
      }
      // Nota: il ripristino della posizione riattiva il controllo duplicati,
      // che azzera dedupConfirmed. Una conferma pre-reload va quindi
      // riconfermata: comportamento voluto (meglio che inviare alla cieca).
      setDedupConfirmed(draft.dedupConfirmed);
    } catch {
      // Storage non disponibile: si parte da form vuoto.
    }
  }, [setValue]);

  // Salvataggio bozza a ogni modifica (solo testo, posizione e indirizzo,
  // mai la foto).
  useEffect(() => {
    try {
      const draft: SubmitCourtDraft = {
        name: draftName,
        selectedSport: draftSport,
        surface: draftSurface,
        position,
        address,
        dedupConfirmed,
      };
      sessionStorage.setItem(SUBMIT_COURT_DRAFT_KEY, encodeSubmitCourtDraft(draft));
    } catch {
      // Storage pieno o non disponibile: il form resta comunque usabile.
    }
  }, [draftName, draftSport, draftSurface, position, address, dedupConfirmed]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Dedup sulla posizione scelta, GPS o manuale che sia. Il debounce evita
  // una RPC per ogni tasto degli input coordinate; `dedupConfirmed` si
  // riarma subito, non dopo la risposta.
  useEffect(() => {
    if (!position) {
      setDedupCandidates(null);
      setDedupConfirmed(false);
      setDedupLoading(false);
      return;
    }

    let cancelled = false;
    setDedupLoading(true);
    setDedupConfirmed(false);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error: rpcError } = await supabase.rpc("dedup_candidates", {
            p_lat: position.lat,
            p_lng: position.lng,
            p_radius_m: 100,
          });
          if (cancelled) return;
          if (rpcError) {
            // Non blocchiamo il flusso se la dedup fallisce.
            setDedupCandidates([]);
            return;
          }
          setDedupCandidates((data as DedupCandidate[] | null) ?? []);
        } finally {
          if (!cancelled) setDedupLoading(false);
        }
      })();
    }, DEDUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [position, supabase]);

  useEffect(() => {
    if (success && successHeadingRef.current) {
      successHeadingRef.current.focus();
    }
  }, [success]);

  useEffect(() => {
    if (error && errorAlertRef.current) {
      errorAlertRef.current.focus();
    }
  }, [error]);

  // Al cambio di modalità il focus va nella sezione appena aperta. Solo se
  // il cambio viene dall'utente: un draft ripristinato non deve rubare il
  // focus all'ingresso nella pagina.
  useEffect(() => {
    if (!shouldFocusModePanel.current) return;
    shouldFocusModePanel.current = false;
    const target = positionMode === "gps" ? gpsPanelRef.current : manualPanelRef.current;
    target?.focus();
  }, [positionMode]);

  const changePositionMode = (mode: PositionSource) => {
    if (mode === positionMode) return;
    shouldFocusModePanel.current = true;
    setPositionMode(mode);
  };

  // Passando alla modalità manuale con una posizione già scelta (es. GPS)
  // gli input partono da lì: non si ricomincia da zero.
  useEffect(() => {
    if (positionMode !== "manual") return;
    if (!position) return;
    setLatInput((prev) => (prev === "" ? formatCoordinateValue(position.lat) : prev));
    setLngInput((prev) => (prev === "" ? formatCoordinateValue(position.lng) : prev));
  }, [positionMode, position]);

  const applyManualCoords = (coords: { lat: number; lng: number }) => {
    setLatInput(formatCoordinateValue(coords.lat));
    setLngInput(formatCoordinateValue(coords.lng));
    setPosition({ source: "manual", lat: coords.lat, lng: coords.lng });
    setCoordsTouched(false);
    setCoordsEdited(false);
    setPositionAnnouncement(
      `Posizione scelta: ${formatCoordinates(coords.lat, coords.lng)}`
    );
  };

  const updateManualFromInputs = (nextLat: string, nextLng: string) => {
    setCoordsEdited(true);
    const lat = parseCoordinate(nextLat, "lat");
    const lng = parseCoordinate(nextLng, "lng");
    if (lat.valid && lng.valid && lat.value !== null && lng.value !== null) {
      setPosition({ source: "manual", lat: lat.value, lng: lng.value });
    } else {
      // Input incompleto o sbagliato: nessuna posizione da inviare. Meglio
      // niente che una coordinata vecchia rimasta lì per inerzia.
      setPosition(null);
    }
  };

  const manualCoordsFromInputs = (): { lat: number; lng: number } | null => {
    const lat = parseCoordinate(latInput, "lat");
    const lng = parseCoordinate(lngInput, "lng");
    if (lat.valid && lng.valid && lat.value !== null && lng.value !== null) {
      return { lat: lat.value, lng: lng.value };
    }
    return null;
  };

  const latParsed = parseCoordinate(latInput, "lat");
  const lngParsed = parseCoordinate(lngInput, "lng");
  const latError = coordsTouched
    ? latParsed.error ?? (latInput.trim() === "" ? "Inserisci la latitudine." : null)
    : null;
  const lngError = coordsTouched
    ? lngParsed.error ?? (lngInput.trim() === "" ? "Inserisci la longitudine." : null)
    : null;

  const pickerValue = useMemo(
    () => (position ? { lat: position.lat, lng: position.lng } : null),
    [position]
  );
  const pickerCenter = position ?? ROME_CENTER;

  const requestLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocalizzazione non supportata dal tuo dispositivo.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: CourtPosition = {
          source: "gps",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setPosition(next);
        setLatInput(formatCoordinateValue(next.lat));
        setLngInput(formatCoordinateValue(next.lng));
        setCoordsTouched(false);
        setCoordsEdited(false);
        setPositionAnnouncement(
          `Posizione GPS acquisita. Precisione ${Math.round(next.accuracy)} metri.`
        );
        setLocationLoading(false);
      },
      (geoErr) => {
        let message = "Impossibile ottenere la posizione.";
        if (geoErr.code === 1) {
          message = "Permesso negato. Abilita la geolocalizzazione e riprova.";
        } else if (geoErr.code === 2) {
          message = "Posizione non disponibile. Verifica che il GPS sia attivo.";
        } else if (geoErr.code === 3) {
          message = "Timeout della richiesta GPS. Riprova.";
        }
        setLocationError(message);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Reset sempre: senza questo, riselezionare lo STESSO file non fa
    // scattare onChange e il tentativo sembra ignorato ("4 tentativi").
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      setError(
        "La foto supera i 25 MB: scegli un file più piccolo o scatta a una risoluzione inferiore."
      );
      return;
    }

    // `file.type` vuoto (foto scattata al momento su alcuni Android) NON è
    // un rifiuto: il contenuto viene comunque ricodificato in JPEG.
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoLoading(true);
    try {
      setPhotoFile(file);
      setValue("hasPhoto", true);
      setPhotoPreview(URL.createObjectURL(file));
      setDebugDetail(null);
    } finally {
      setPhotoLoading(false);
    }
  };

  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setValue("hasPhoto", false);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Guardia anti-doppio-invio (il disabled da solo non basta tra due
  // submit ravvicinati prima del re-render).
  const submittingRef = useRef(false);

  const focusFirstError = (fieldErrors: FieldErrors<SubmitCourtValues>) => {
    const order: (keyof SubmitCourtValues)[] = ["name", "sport", "surface"];
    for (const field of order) {
      if (fieldErrors[field]) {
        setFocus(field);
        return;
      }
    }
  };

  const onValidSubmit = async (values: SubmitCourtValues) => {
    setError(null);
    setDebugDetail(null);

    if (submittingRef.current) return;

    if (!user) {
      onLoginRequired();
      return;
    }

    // In modalità manuale il testo degli input è la fonte di verità: evita
    // che un valore intermedio (es. "4" mentre si digita "41.89") parta per
    // sbaglio. Con coordinate non toccate resta la posizione già scelta
    // (es. GPS) con la sua fonte e la sua accuratezza.
    let submitPosition: CourtPosition | null = position;
    if (positionMode === "manual") {
      const manual = manualCoordsFromInputs();
      if (!manual) {
        setCoordsTouched(true);
        setError(
          "La posizione è obbligatoria. Inserisci latitudine e longitudine o scegli un punto sulla mappa."
        );
        return;
      }
      if (coordsEdited || !submitPosition) {
        submitPosition = { source: "manual", lat: manual.lat, lng: manual.lng };
      }
    }

    if (!submitPosition) {
      if (positionMode === "manual") setCoordsTouched(true);
      setError("La posizione è obbligatoria. Usa il GPS o scegli un punto sulla mappa.");
      return;
    }

    if (dedupCandidates && dedupCandidates.length > 0 && !dedupConfirmed) {
      setError("Conferma che non si tratta di un duplicato prima di inviare.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    let uploadedPath: string | null = null;

    try {
      if (photoFile) {
        const upload = await uploadCourtPhoto(supabase, photoFile);
        uploadedPath = upload.path;
      }

      const { error: rpcError } = await supabase.rpc("submit_court", {
        p_name: values.name.trim(),
        p_lat: submitPosition.lat,
        p_lng: submitPosition.lng,
        p_sport: values.sport,
        p_surface: values.surface || undefined,
        // Manuale = nessuna accuratezza: il parametro si omette, non si
        // manda 0 né un numero inventato.
        p_gps_accuracy:
          submitPosition.source === "gps" ? submitPosition.accuracy : undefined,
        // Indirizzo facoltativo: vuoto = parametro assente.
        p_address: sanitizeAddress(address) || undefined,
        p_photo_path: uploadedPath ?? undefined,
      });

      if (rpcError) {
        if (uploadedPath) {
          await deleteCourtPhoto(supabase, uploadedPath);
          uploadedPath = null;
        }

        if (rpcError.code === "P0001") {
          setError(formatRpcError(rpcError.message));
        } else {
          setError(rpcError.message || "Errore durante l'invio. Riprova più tardi.");
        }
        return;
      }

      setSubmittedName(values.name.trim() || "Campo senza nome");
      setSuccess(true);
      try {
        sessionStorage.removeItem(SUBMIT_COURT_DRAFT_KEY);
      } catch {
        // Bozza già persa o storage non disponibile: nessun impatto.
      }
    } catch (err) {
      if (uploadedPath) {
        await deleteCourtPhoto(supabase, uploadedPath);
      }
      // L'errore foto deve arrivare all'utente, non restare in console.
      // `uploadedPath` valorizzato = upload riuscito ed errore RPC
      // successivo: in quel caso il dettaglio foto non c'entra.
      if (photoFile && !uploadedPath) {
        setDebugDetail(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
      setError(err instanceof Error ? err.message : "Errore durante l'invio. Riprova più tardi.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 page-enter">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--success)]/10 text-[var(--success)] animate-success-pop">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] focus:outline-none"
          >
            Campo inviato, in revisione
          </h2>
          <p className="text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">{submittedName}</span> verrà
            verificato prima di apparire sulla mappa.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-control font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[48px]"
        >
          Torna alla mappa
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onValidSubmit, focusFirstError)} className="space-y-6" noValidate>
      {error && (
        <div
          ref={errorAlertRef}
          tabIndex={-1}
          className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm animate-scale-in"
          role="alert"
          aria-live="assertive"
        >
          {error}
          {debugDetail && process.env.NODE_ENV !== "production" && (
            <p className="mt-2 font-mono text-xs opacity-80 break-all">
              Errore foto: {debugDetail}
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Posizione</h2>

        <fieldset className="space-y-2">
          <legend className="text-sm text-[var(--text-secondary)]">
            Come vuoi indicare la posizione?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {POSITION_MODES.map((mode) => (
              <label
                key={mode.value}
                className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-control border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-elevated)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-subtle)] has-[:checked]:text-[var(--text-primary)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-base)]"
              >
                <input
                  type="radio"
                  name="position-mode"
                  value={mode.value}
                  checked={positionMode === mode.value}
                  onChange={() => changePositionMode(mode.value)}
                  className="sr-only"
                />
                {mode.value === "gps" ? (
                  <Navigation className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                ) : (
                  <MapPin className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                )}
                {mode.label}
              </label>
            ))}
          </div>
        </fieldset>

        {positionMode === "gps" ? (
          <div
            ref={gpsPanelRef}
            tabIndex={-1}
            role="group"
            aria-label="Posizione GPS"
            className="space-y-2 focus:outline-none"
          >
            <Button
              type="button"
              onClick={requestLocation}
              disabled={locationLoading}
              className="w-full"
              variant="secondary"
            >
              {locationLoading ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" />
                  Ricerca posizione...
                </>
              ) : position?.source === "gps" ? (
                "Riprova"
              ) : (
                <>
                  <MapPin className="w-4 h-4 me-2" aria-hidden="true" />
                  Usa la mia posizione
                </>
              )}
            </Button>
            <p className="text-xs text-[var(--text-muted)]">
              Ti chiederemo il permesso di accedere al GPS del dispositivo.
            </p>

            {locationError && !error && (
              <div
                className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm"
                role="alert"
                aria-live="assertive"
              >
                {locationError}
              </div>
            )}
          </div>
        ) : (
          <div
            ref={manualPanelRef}
            tabIndex={-1}
            role="group"
            aria-label="Posizione scelta sulla mappa"
            className="space-y-3 focus:outline-none"
          >
            <LocationPicker
              center={pickerCenter}
              value={pickerValue}
              onChange={applyManualCoords}
            />
            <p className="text-xs text-[var(--text-muted)]">
              Trascina il pin sul campo o tocca la mappa per spostarlo. Puoi anche
              inserire le coordinate qui sotto.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={latId}
                  className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
                >
                  Latitudine
                </label>
                <Input
                  id={latId}
                  value={latInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLatInput(next);
                    updateManualFromInputs(next, lngInput);
                  }}
                  onBlur={() => setCoordsTouched(true)}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="41.89190"
                  aria-invalid={latError ? "true" : undefined}
                  aria-describedby={
                    latError ? `${latId}-hint ${latId}-error` : `${latId}-hint`
                  }
                />
                <p id={`${latId}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
                  Da {LATITUDE_MIN} a {LATITUDE_MAX}. Es. 41.89190
                </p>
                {latError && (
                  <p id={`${latId}-error`} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                    {latError}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={lngId}
                  className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
                >
                  Longitudine
                </label>
                <Input
                  id={lngId}
                  value={lngInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLngInput(next);
                    updateManualFromInputs(latInput, next);
                  }}
                  onBlur={() => setCoordsTouched(true)}
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="12.51130"
                  aria-invalid={lngError ? "true" : undefined}
                  aria-describedby={
                    lngError ? `${lngId}-hint ${lngId}-error` : `${lngId}-hint`
                  }
                />
                <p id={`${lngId}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
                  Da {LONGITUDE_MIN} a {LONGITUDE_MAX}. Es. 12.51130
                </p>
                {lngError && (
                  <p id={`${lngId}-error`} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                    {lngError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {position && (
          <div className="rounded-control bg-[var(--bg-surface)] p-3 space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              {position.source === "gps" ? (
                <>
                  <Navigation className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                  Posizione GPS acquisita
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
                  Posizione scelta manualmente
                </>
              )}
            </p>
            {position.source === "gps" ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Precisione GPS: {Math.round(position.accuracy)} m
              </p>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Nessuna precisione GPS: il punto l&apos;hai scelto tu.
              </p>
            )}
            <p className="text-sm text-[var(--text-secondary)] tabular-nums">
              {formatCoordinates(position.lat, position.lng)}
            </p>
            {position.source === "gps" && position.accuracy > LOCATION_ACCURACY_THRESHOLD && (
              <div className="flex items-start gap-2 text-sm text-[var(--warning)]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Precisione scarsa: la posizione potrebbe essere imprecisa. Puoi riprovare in un
                  punto aperto o scegliere il punto sulla mappa.
                </span>
              </div>
            )}
          </div>
        )}

        {position && (
          <div>
            <label
              htmlFor={addressId}
              className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
            >
              Indirizzo{" "}
              <span className="font-normal text-[var(--text-muted)]">(facoltativo)</span>
            </label>
            <Input
              id={addressId}
              value={address}
              onChange={(e) => setAddress(clampAddressInput(e.target.value))}
              maxLength={ADDRESS_MAX}
              autoComplete="off"
              placeholder="Es. Via Roma 10, Roma"
              aria-describedby={`${addressId}-hint`}
            />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              <p id={`${addressId}-hint`} className="text-xs text-[var(--text-muted)]">
                Via e numero civico, se li conosci. Massimo {ADDRESS_MAX} caratteri.
              </p>
              {address.length >= ADDRESS_MAX - 40 && (
                <span
                  className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]"
                  aria-hidden="true"
                >
                  {address.length}/{ADDRESS_MAX}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {dedupLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]" aria-live="polite">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Controllo duplicati nelle vicinanze...
        </div>
      )}

      {dedupCandidates && dedupCandidates.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Campi simili nelle vicinanze
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Se il campo che vuoi aggiungere è già presente, selezionalo per evitare duplicati.
          </p>
          <ul className="space-y-2">
            {dedupCandidates.map((candidate, index) => (
              <li
                key={dedupCandidateKey(candidate, index)}
                className="bg-[var(--bg-surface)] rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">
                    {candidate.name}
                  </p>
                  {candidate.distance_m != null && (
                    <p className="text-xs text-[var(--text-muted)]">
                      a {Math.round(candidate.distance_m)} m
                    </p>
                  )}
                </div>
                {canNavigateToCandidate(candidate) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (candidate.id) router.push(`/courts/${candidate.id}`);
                    }}
                  >
                    È lo stesso
                  </Button>
                ) : (
                  <span className="shrink-0 text-end text-xs text-[var(--text-muted)]">
                    Dettaglio non disponibile
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!dedupConfirmed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setDedupConfirmed(true)}
            >
              Non è un duplicato, invia
            </Button>
          ) : (
            <div className="text-center text-sm text-[var(--success)]">
              Confermato: non è un duplicato
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div>
          <label htmlFor={nameId} className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
            Nome del campo
          </label>
          <Input
            id={nameId}
            {...register("name")}
            placeholder="Es. Campetto Via Napoli"
            aria-label="Nome del campo"
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={
              errors.name ? `${nameId}-hint ${nameId}-error` : `${nameId}-hint`
            }
          />
          <p id={`${nameId}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
            Opzionale se carichi una foto, altrimenti obbligatorio.
          </p>
          {errors.name && (
            <p id={`${nameId}-error`} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={sportId} className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
            Sport
          </label>
          <select
            id={sportId}
            {...register("sport")}
            aria-invalid={errors.sport ? "true" : undefined}
            aria-describedby={errors.sport ? `${sportId}-error` : undefined}
            className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3.5 text-base border border-transparent transition-colors focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[48px]"
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.sport && (
            <p id={`${sportId}-error`} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
              {errors.sport.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={surfaceId} className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5">
            Superficie
          </label>
          <select
            id={surfaceId}
            {...register("surface")}
            aria-invalid={errors.surface ? "true" : undefined}
            aria-describedby={errors.surface ? `${surfaceId}-error` : undefined}
            className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3.5 text-base border border-transparent transition-colors focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[48px]"
          >
            {SURFACE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.surface && (
            <p id={`${surfaceId}-error`} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
              {errors.surface.message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <label htmlFor={photoId} className="text-sm font-semibold text-[var(--text-primary)] block">
          Foto
        </label>

        {!photoPreview ? (
          <div>
            <input
              id={photoId}
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="sr-only"
              aria-label="Seleziona una foto del campo"
              aria-describedby={`${photoId}-hint`}
            />
            <label
              htmlFor={photoId}
              className="flex flex-col items-center justify-center gap-2 w-full rounded-control border-2 border-dashed border-[var(--cool-muted)]/30 bg-[var(--bg-surface)] px-4 py-6 text-[var(--text-secondary)] transition-colors active:bg-[var(--bg-elevated)] min-h-[120px]"
            >
              <Camera className="w-6 h-6" aria-hidden="true" />
              <span className="text-sm font-medium">Tocca per scattare o selezionare</span>
              <span id={`${photoId}-hint`} className="text-xs text-[var(--text-muted)]">
                JPEG/PNG/WebP, max 5 MB. Verrà ridimensionata per rimuovere i metadati.
              </span>
            </label>
          </div>
        ) : (
          <div className="relative rounded-control overflow-hidden bg-[var(--bg-surface)] aspect-video">
            {photoLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" aria-hidden="true" />
              </div>
            ) : (
              <>
                {/* eslint-disable @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Anteprima della foto del campo"
                  className="w-full h-full object-cover"
                />
                {/* eslint-enable @next/next/no-img-element */}
              </>
            )}
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-2 end-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-elevated)]/90 text-[var(--text-primary)] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Rimuovi foto"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      {!draftName.trim() && !photoFile && (
        <p className="text-sm text-[var(--warning)]">
          Aggiungi un nome o una foto per inviare il campo.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" />
            Invio in corso...
          </>
        ) : (
          "Invia campo"
        )}
      </Button>

      {!user && (
        <p className="text-center text-sm text-[var(--text-muted)]">
          Dopo aver compilato il form, ti chiederemo di accedere per inviare il campo.
        </p>
      )}

      <div aria-live="polite" className="sr-only">
        {submitting ? "Invio del campo in corso." : ""}
      </div>
      <div aria-live="polite" className="sr-only">
        {positionAnnouncement}
      </div>
    </form>
  );
}

function LocationPickerLoading() {
  return (
    <div
      className="flex h-[220px] w-full items-center justify-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)]"
      role="status"
    >
      <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Caricamento mappa…
      </span>
    </div>
  );
}

function formatRpcError(message: string): string {
  // I messaggi RPC sono già in italiano e leggibili.
  // Evidenziamo solo il rate limit con un'indicazione temporale più chiara.
  if (/rate limit|troppo presto|1 ora|un'ora|un ora/i.test(message)) {
    return `${message} Potrai riprovare tra circa un'ora.`;
  }
  return message;
}
