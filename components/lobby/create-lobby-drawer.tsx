"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LOBBY_DURATION_MAX_MINUTES,
  LOBBY_DURATION_MIN_MINUTES,
  SPORT_VALUES,
  createLobbySchema,
  type CreateLobbyInput,
  type CreateLobbyValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import {
  formatAppCloseTime,
  formatAppDateTime,
  formatAppTime,
} from "@/lib/datetime";
import {
  DEFAULT_LOBBY_DURATION_MINUTES,
  SPORTS,
  defaultDurationForSport,
  uniqueCourtSport,
} from "@/lib/sport/sports";
import { findOverlappingLobby, lobbyEndsAtIso } from "@/lib/lobby/overlap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { StepTransition } from "@/components/motion/step-transition";
import { SuccessPop } from "@/components/motion/success-pop";
import { StartTimePicker } from "@/components/lobby/start-time-picker";

interface CreateLobbyDrawerProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  /** Sport del Campo: preseleziona quello della Lobby se univoco (#96). */
  courtSport: string | null;
}

/**
 * Sport offerti per la Lobby: gli stessi del form, meno `multi`. La Lobby è
 * una partita di UN sport; "polivalente" descrive il Campo, non l'evento.
 * "Non specificato" (valore vuoto) resta l'opzione prudente: NULL = ignoto.
 */
const LOBBY_SPORTS = SPORTS.filter((option) => option.value !== "multi");

/** Etichetta leggibile per lo sport di una Lobby (`null` = ignoto). */
function lobbySportLabel(sport: string | null): string {
  if (sport === null) return "Sport non specificato";
  return LOBBY_SPORTS.find((option) => option.value === sport)?.label ?? sport;
}

/**
 * Sport preselezionato dal Campo: solo se `uniqueCourtSport` restituisce un
 * valore che l'UI conosce. Un campo `multi`, multi-valore o con uno sport
 * fuori lista lascia la scelta esplicita all'utente.
 */
function preselectedLobbySport(
  courtSport: string | null,
): (typeof SPORT_VALUES)[number] | undefined {
  const unique = uniqueCourtSport(courtSport);
  if (unique === null) return undefined;
  return (SPORT_VALUES as readonly string[]).includes(unique)
    ? (unique as (typeof SPORT_VALUES)[number])
    : undefined;
}

/** Lobby che occupa lo stesso Campo nello stesso intervallo. */
interface OverlapNotice {
  id: string;
  startTime: string;
  endsAt: string | null;
  sport: string | null;
  maxPlayers: number;
  participants: number;
}

interface OverlapCheck {
  lobby: OverlapNotice;
  /**
   * Valori grezzi del form al momento del controllo: il secondo invio
   * identico è il consenso esplicito a creare comunque (#96). Nessun flag
   * persistito: cambiare un campo azzera l'avviso e rifà il controllo.
   */
  snapshot: {
    startTime: unknown;
    durationMinutes: unknown;
    sport: unknown;
  };
}

type OverlapRow = {
  id: string;
  start_time: string;
  ends_at: string | null;
  sport: string | null;
  max_players: number;
  lobby_participants: { user_id: string }[] | null;
};

export function CreateLobbyDrawer({
  open,
  onClose,
  courtId,
  courtName,
  courtSport,
}: CreateLobbyDrawerProps) {
  const initialSport = preselectedLobbySport(courtSport);

  // Orario, sport, durata e posti in react-hook-form (schema zod = unica
  // fonte). Restano useState solo per: loading, errori di rete/DB, esito e
  // avviso doppioni. La durata parte dal default dello sport della Lobby
  // (#96): pallavolo e padel 90', futsal 60', il resto 30'.
  const {
    control,
    register,
    handleSubmit,
    setFocus,
    getValues,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateLobbyInput, unknown, CreateLobbyValues>({
    resolver: zodResolver(createLobbySchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      startTime: "",
      maxPlayers: 10,
      durationMinutes: defaultDurationForSport(initialSport ?? null),
      sport: initialSport,
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [createdPlayers, setCreatedPlayers] = useState(10);
  const [overlap, setOverlap] = useState<OverlapCheck | null>(null);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const warningRef = useRef<HTMLDivElement | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const startTimeValue = watch("startTime");
  const durationValue = watch("durationMinutes");
  const sportValue = watch("sport");

  // Un avviso doppioni calcolato su valori diversi da quelli attuali è
  // rumore: sparisce appena si tocca un campo, e il submit rifà il controllo.
  useEffect(() => {
    if (!overlap) return;
    const { snapshot } = overlap;
    if (
      snapshot.startTime !== startTimeValue ||
      snapshot.durationMinutes !== durationValue ||
      snapshot.sport !== sportValue
    ) {
      setOverlap(null);
    }
  }, [overlap, startTimeValue, durationValue, sportValue]);

  // L'avviso sostituisce il bottone di invio: il focus va portato lì, altrimenti
  // dopo la scomparsa del bottone resterebbe sul body dentro un focus trap.
  useEffect(() => {
    if (overlap) warningRef.current?.focus();
  }, [overlap]);

  // `defaultValues` vale solo al mount: senza reset, la riapertura sullo
  // stesso campo ritrova orario/sport/durata precedenti — con un orario ormai
  // passato il submit fallisce. Solo sulla transizione chiuso→aperto: mai
  // mentre l'utente sta scrivendo. La durata riparte dal default dello sport
  // iniziale, quindi l'euristica "segue lo sport finché non la tocchi" resta.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (open) {
      if (!prevOpen.current) {
        reset({
          startTime: "",
          maxPlayers: 10,
          durationMinutes: defaultDurationForSport(initialSport ?? null),
          sport: initialSport,
        });
      }
    } else {
      queueMicrotask(() => {
        setError(null);
        setCreated(false);
        setOverlap(null);
      });
    }
    prevOpen.current = open;
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open, reset, initialSport]);

  const durationMinutes = Number(durationValue);
  const durationValid =
    Number.isInteger(durationMinutes) &&
    durationMinutes >= LOBBY_DURATION_MIN_MINUTES &&
    durationMinutes <= LOBBY_DURATION_MAX_MINUTES;
  // Anteprima della chiusura: `ends_at` vero nasce nel DB all'INSERT, qui
  // serve solo a rendere leggibile "90 minuti".
  const closePreview =
    startTimeValue && durationValid
      ? formatAppTime(lobbyEndsAtIso(startTimeValue, durationMinutes))
      : null;

  const focusFirstError = (fieldErrors: FieldErrors<CreateLobbyInput>) => {
    const order: (keyof CreateLobbyInput)[] = [
      "startTime",
      "durationMinutes",
      "maxPlayers",
    ];
    for (const field of order) {
      if (fieldErrors[field]) {
        setFocus(field);
        return;
      }
    }
  };

  /**
   * Lobby aperte sullo stesso Campo che si sovrappongono alla candidata, con
   * sport compatibile (#96, #91: `open` è l'unico stato vivo, "in corso" si
   * deriva dal tempo). Consultivo, non un vincolo: se la lettura fallisce si
   * prosegue e l'INSERT resta l'ultima difesa.
   */
  const findExistingLobby = async (
    startTime: string,
    lobbyDuration: number,
    sport: string | null,
  ): Promise<OverlapNotice | null> => {
    try {
      let query = supabase
        .from("lobbies")
        .select(
          "id, start_time, ends_at, sport, max_players, lobby_participants(user_id)",
        )
        .eq("court_id", courtId)
        .eq("status", "open")
        .lt("start_time", lobbyEndsAtIso(startTime, lobbyDuration))
        .gt("ends_at", startTime);
      if (sport !== null && (SPORT_VALUES as readonly string[]).includes(sport)) {
        // Allowlist prima di interpolare in PostgREST: la stringa non dipende
        // da chi fornisce il valore (oggi lo zod enum, domani chissà).
        query = query.or(`sport.is.null,sport.eq.${sport}`);
      }
      const { data, error: selectError } = await query
        .order("start_time", { ascending: true })
        .limit(5);
      if (selectError) throw selectError;

      const rows = (data ?? []) as OverlapRow[];
      const found = findOverlappingLobby(rows, {
        startTime,
        durationMinutes: lobbyDuration,
        sport,
      });
      if (!found) return null;

      return {
        id: found.id,
        startTime: found.start_time,
        endsAt: found.ends_at,
        sport: found.sport,
        maxPlayers: found.max_players,
        participants: found.lobby_participants?.length ?? 0,
      };
    } catch {
      return null;
    }
  };

  const onValidCreate = async (values: CreateLobbyValues) => {
    if (submittingRef.current) return;

    // Il consenso vale solo per gli stessi valori su cui è stato mostrato
    // l'avviso: se il form è cambiato, si rifà il controllo.
    const raw = {
      startTime: getValues("startTime"),
      durationMinutes: getValues("durationMinutes"),
      sport: getValues("sport"),
    };
    const consent =
      overlap !== null &&
      overlap.snapshot.startTime === raw.startTime &&
      overlap.snapshot.durationMinutes === raw.durationMinutes &&
      overlap.snapshot.sport === raw.sport;

    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Devi effettuare l'accesso per creare una lobby.");
      }

      // Check for ban before attempting insert
      const { data: profile } = await supabase
        .from("profiles")
        .select("banned_until, karma_score")
        .eq("user_id", user.id)
        .single();

      if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
        throw new Error(
          `Sei bannato fino al ${formatAppDateTime(profile.banned_until)}. Non puoi creare lobby.`
        );
      }

      if ((profile?.karma_score ?? 90) < 50) {
        throw new Error(
          `Karma troppo basso (${profile?.karma_score}). Non puoi creare lobby.`
        );
      }

      const lobbyDuration =
        values.durationMinutes ?? DEFAULT_LOBBY_DURATION_MINUTES;
      const lobbySport = values.sport ?? null;

      if (!consent) {
        const existing = await findExistingLobby(
          values.startTime,
          lobbyDuration,
          lobbySport,
        );
        if (existing) {
          setOverlap({ lobby: existing, snapshot: raw });
          return;
        }
        setOverlap(null);
      }

      const { error } = await supabase.from("lobbies").insert({
        court_id: courtId,
        creator_id: user.id,
        start_time: new Date(values.startTime).toISOString(),
        max_players: values.maxPlayers,
        duration_minutes: lobbyDuration,
        sport: lobbySport,
        status: "open",
      });

      if (error) {
        // Handle PG exception strings from database triggers
        const msg = error.message.toLowerCase();
        if (msg.includes("bannato")) throw error;
        if (msg.includes("karma")) throw error;
        throw error;
      }

      // Successo: l'esito resta dentro il drawer, poi si chiude e la
      // pagina si aggiorna (router.refresh + realtime) — mai reload.
      setOverlap(null);
      setCreatedPlayers(values.maxPlayers);
      setCreated(true);
      closeTimer.current = window.setTimeout(() => {
        onClose();
        router.refresh();
      }, 1400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore durante la creazione della lobby.";
      setError(msg);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // "Unisciti" porta al dettaglio della lobby che occupa lo slot: è lì che
  // vive il join con i suoi controlli (piena, bannato, karma). Il drawer si
  // chiude come per ogni navigazione.
  const joinExistingLobby = () => {
    if (!overlap) return;
    onClose();
    router.push(`/lobbies/${overlap.lobby.id}`);
  };

  const overlapFull =
    overlap !== null && overlap.lobby.participants >= overlap.lobby.maxPlayers;

  // "Non specificato" (valore vuoto) = NULL nel DB: `setValueAs` lo traduce
  // in `undefined`, che lo schema opzionale accetta.
  const sportField = register("sport", {
    setValueAs: (value) => (value === "" ? undefined : value),
  });

  return (
    <Drawer open={open} onClose={onClose} title="Crea lobby">
      {/* Entrata/uscita del drawer restano quelle di Base UI: qui dentro si
          scambia solo il contenuto (form -> esito), senza animazioni custom
          sul contenitore e senza salti di layout. */}
      <StepTransition stepKey={created ? "done" : "form"}>
        {created ? (
          <SuccessPop
            title="Lobby creata"
            description={`${courtName} · fino a ${createdPlayers} giocatori. La trovi in "Lobby attive" con lo stato "Sei dentro".`}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
                Campo
              </label>
              <p className="text-[var(--text-primary)] font-medium">{courtName}</p>
            </div>

            {error && (
              <div
                className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onValidCreate, focusFirstError)} className="space-y-3" noValidate>
              <Controller
                control={control}
                name="startTime"
                render={({ field, fieldState }) => (
                  <StartTimePicker
                    value={field.value ? field.value : null}
                    onChange={field.onChange}
                    focusRef={field.ref}
                    invalid={Boolean(fieldState.error)}
                    error={fieldState.error?.message}
                  />
                )}
              />

              <div>
                <label
                  htmlFor="lobby-sport"
                  className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
                >
                  Sport
                </label>
                <select
                  id="lobby-sport"
                  {...sportField}
                  onChange={(event) => {
                    const previousSport = getValues("sport") ?? null;
                    const previousDefault = defaultDurationForSport(previousSport);
                    const currentDuration = Number(getValues("durationMinutes"));
                    sportField.onChange(event);
                    // La durata segue il default del nuovo sport finché
                    // l'utente non l'ha scelta a mano.
                    if (currentDuration === previousDefault) {
                      setValue(
                        "durationMinutes",
                        defaultDurationForSport(event.target.value || null),
                      );
                    }
                  }}
                  aria-describedby="lobby-sport-hint"
                  className="flex w-full min-h-[44px] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3 text-base border border-transparent transition-colors focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                >
                  <option value="">Non specificato</option>
                  {LOBBY_SPORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p id="lobby-sport-hint" className="mt-1.5 text-xs text-[var(--text-muted)]">
                  {initialSport
                    ? "Preselezionato dal campo: cambialo se serve."
                    : "Se non lo scegli, la lobby vale per qualsiasi sport."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="lobby-duration"
                  className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
                >
                  Durata (minuti)
                </label>
                <Input
                  id="lobby-duration"
                  type="number"
                  inputMode="numeric"
                  {...register("durationMinutes")}
                  aria-invalid={errors.durationMinutes ? "true" : undefined}
                  aria-describedby={
                    errors.durationMinutes
                      ? "lobby-duration-error"
                      : "lobby-duration-hint"
                  }
                />
                <p id="lobby-duration-hint" className="mt-1.5 text-xs text-[var(--text-muted)]">
                  {closePreview
                    ? `Chiusura iscrizioni alle ${closePreview}.`
                    : `Da ${LOBBY_DURATION_MIN_MINUTES} a ${LOBBY_DURATION_MAX_MINUTES} minuti.`}
                </p>
                {errors.durationMinutes && (
                  <p id="lobby-duration-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                    {errors.durationMinutes.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lobby-max-players"
                  className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
                >
                  Numero massimo giocatori
                </label>
                <Input
                  id="lobby-max-players"
                  type="number"
                  inputMode="numeric"
                  {...register("maxPlayers")}
                  aria-invalid={errors.maxPlayers ? "true" : undefined}
                  aria-describedby={errors.maxPlayers ? "lobby-max-players-error" : undefined}
                />
                {errors.maxPlayers && (
                  <p id="lobby-max-players-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                    {errors.maxPlayers.message}
                  </p>
                )}
              </div>

              {overlap && (
                <div
                  ref={warningRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 focus:outline-none"
                >
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    C&apos;è già una lobby su questo campo
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {lobbySportLabel(overlap.lobby.sport)} ·{" "}
                    {formatAppDateTime(overlap.lobby.startTime)}
                    {overlap.lobby.endsAt
                      ? `–${formatAppCloseTime(overlap.lobby.endsAt)}`
                      : ""}{" "}
                    ·{" "}
                    {overlapFull
                      ? "piena"
                      : `${overlap.lobby.participants}/${overlap.lobby.maxPlayers} giocatori`}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {!overlapFull && (
                      <Button
                        type="button"
                        className="min-h-11 w-full"
                        onClick={joinExistingLobby}
                        disabled={loading}
                      >
                        Unisciti
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant={overlapFull ? "primary" : "secondary"}
                      className="min-h-11 w-full"
                      disabled={loading}
                    >
                      {loading ? "Creazione..." : "Crea comunque"}
                    </Button>
                  </div>
                </div>
              )}

              {!overlap && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creazione..." : "Crea lobby"}
                </Button>
              )}
            </form>
          </div>
        )}
      </StepTransition>
    </Drawer>
  );
}
