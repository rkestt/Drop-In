"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  submitCourtSchema,
  type SubmitCourtValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { useSport } from "@/lib/sport/sport-context";
import { SPORTS, type Sport } from "@/lib/sport/sports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadCourtPhoto, deleteCourtPhoto } from "@/lib/storage/court-photos";
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

interface DedupCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
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

const LOCATION_ACCURACY_THRESHOLD = 100; // meters
const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // rifiuto esplicito pre-elaborazione

// Bozza del form in sessionStorage: aprire la fotocamera su Android può far
// ricaricare la pagina (pressione di memoria). La foto NON viene salvata:
// dopo un reload l'utente riseleziona solo quella.
const DRAFT_STORAGE_KEY = "submit-court-draft-v1";

interface SubmitCourtDraft {
  name: string;
  selectedSport: Sport;
  surface: string;
  location: { lat: number; lng: number; accuracy: number } | null;
  dedupConfirmed: boolean;
}

export function SubmitCourtForm({ onLoginRequired }: SubmitCourtFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { sport } = useSport();

  const [user, setUser] = useState<{ id: string } | null>(null);

  // Testo del form in react-hook-form (schema zod = unica fonte).
  // Restano useState solo per: file foto, loading, errori di rete/DB, successo.
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

  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null
  );
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
  const nameId = useId();
  const sportId = useId();
  const surfaceId = useId();
  const photoId = useId();

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
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<SubmitCourtDraft>;
      if (typeof draft.name === "string") setValue("name", draft.name);
      if (
        typeof draft.selectedSport === "string" &&
        SPORTS.some((s) => s.value === draft.selectedSport)
      ) {
        setValue("sport", draft.selectedSport as Sport);
      }
      if (typeof draft.surface === "string") setValue("surface", draft.surface);
      const loc = draft.location;
      if (
        loc &&
        typeof loc.lat === "number" &&
        typeof loc.lng === "number" &&
        typeof loc.accuracy === "number"
      ) {
        setLocation({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy });
      }
      // Nota: il ripristino della posizione riattiva il controllo duplicati,
      // che azzera dedupConfirmed. Una conferma pre-reload va quindi
      // riconfermata: comportamento voluto (meglio che inviare alla cieca).
      if (typeof draft.dedupConfirmed === "boolean") setDedupConfirmed(draft.dedupConfirmed);
    } catch {
      // Bozza corrotta o storage non disponibile: si parte da form vuoto.
    }
  }, [setValue]);

  // Salvataggio bozza a ogni modifica (solo testo + posizione, mai la foto).
  useEffect(() => {
    try {
      const draft: SubmitCourtDraft = {
        name: draftName,
        selectedSport: draftSport,
        surface: draftSurface,
        location,
        dedupConfirmed,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage pieno o non disponibile: il form resta comunque usabile.
    }
  }, [draftName, draftSport, draftSurface, location, dedupConfirmed]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!location) {
      setDedupCandidates(null);
      setDedupConfirmed(false);
      return;
    }

    let cancelled = false;
    setDedupLoading(true);
    setDedupConfirmed(false);

    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("dedup_candidates", {
          p_lat: location.lat,
          p_lng: location.lng,
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

    return () => {
      cancelled = true;
    };
  }, [location, supabase]);

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

  const requestLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    setLocation(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocalizzazione non supportata dal tuo dispositivo.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
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

    if (!location) {
      setError("La posizione è obbligatoria. Usa il pulsante per ottenerla.");
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
        p_lat: location.lat,
        p_lng: location.lng,
        p_sport: values.sport,
        p_surface: values.surface || undefined,
        p_photo_path: uploadedPath ?? undefined,
        p_gps_accuracy: location.accuracy,
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
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
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

        {!location ? (
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
            ) : (
              <>
                <MapPin className="w-4 h-4 me-2" aria-hidden="true" />
                Usa la mia posizione
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--success)]">
              <Navigation className="w-4 h-4" aria-hidden="true" />
              Posizione acquisita
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Precisione GPS: {Math.round(location.accuracy)} m
            </p>
            {location.accuracy > LOCATION_ACCURACY_THRESHOLD && (
              <div className="flex items-start gap-2 text-sm text-[var(--warning)]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Precisione scarsa: la posizione potrebbe essere imprecisa. Puoi riprovare in un
                  punto aperto.
                </span>
              </div>
            )}
            <Button
              type="button"
              onClick={requestLocation}
              disabled={locationLoading}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              Riprova
            </Button>
          </div>
        )}

        {locationError && !error && (
          <div
            className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm"
            role="alert"
            aria-live="assertive"
          >
            {locationError}
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
            {dedupCandidates.map((candidate) => (
              <li
                key={candidate.id}
                className="bg-[var(--bg-surface)] rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">
                    {candidate.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    a {Math.round(candidate.distance_m)} m
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/courts/${candidate.id}`)}
                >
                  È lo stesso
                </Button>
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
    </form>
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
