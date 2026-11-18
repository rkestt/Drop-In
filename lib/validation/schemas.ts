import { z } from "zod";

/**
 * Unica fonte delle regole di validazione dei form (client).
 *
 * La validazione zod NON sostituisce i vincoli del DB (trigger/RLS restano
 * l'ultima difesa): se il DB rifiuta, il messaggio resta inline e i dati
 * inseriti vengono conservati.
 *
 * Convenzioni:
 * - messaggi in italiano, mostrati inline sotto il campo;
 * - niente `min`/`max`/`pattern`/`required` duplicati a mano nell'HTML per
 *   le regole coperte qui (restano `type`, `inputMode`, `autoComplete`);
 * - la foto resta fuori dallo schema (file gestito a parte): i form
 *   passano solo il flag `hasPhoto` per la regola "nome o foto".
 */

/**
 * Sport selezionabili nell'UI (stessa lista di `SPORTS` in
 * `lib/sport/sports.ts`, unica fonte lato form). Il DB accetta anche
 * 'altro', ma l'UI non l'ha mai offerto: non lo introduciamo qui.
 */
export const SPORT_VALUES = [
  "basketball",
  "soccer",
  "tennis",
  "volleyball",
  "beach_volleyball",
  "padel",
  "futsal",
  "multi",
] as const;

export const SURFACE_VALUES = [
  "",
  "asphalt",
  "concrete",
  "wood",
  "grass",
  "rubber",
  "tartan",
] as const;

export const REPORT_CATEGORY_VALUES = [
  "broken_hoop",
  "wet_court",
  "lighting",
  "occupied",
  "other",
] as const;

export const COURT_NAME_MAX = 120;
export const NICKNAME_MAX = 30;
export const REPORT_DESCRIPTION_MAX = 280;
export const LOBBY_MIN_PLAYERS = 2;
export const LOBBY_MAX_PLAYERS = 30;
/** Bound durata lobby in minuti (#96): stessi del CHECK su `lobbies`. */
export const LOBBY_DURATION_MIN_MINUTES = 15;
export const LOBBY_DURATION_MAX_MINUTES = 240;

/** Regola DB (submit_court): serve un nome oppure una foto. */
export const submitCourtSchema = z
  .object({
    name: z
      .string()
      .max(COURT_NAME_MAX, `Il nome non può superare i ${COURT_NAME_MAX} caratteri.`),
    sport: z.enum(SPORT_VALUES, { error: "Sport non valido." }),
    surface: z
      .string()
      .refine(
        (v) => (SURFACE_VALUES as readonly string[]).includes(v),
        "Superficie non valida."
      ),
    hasPhoto: z.boolean(),
  })
  .refine((d) => d.name.trim() !== "" || d.hasPhoto, {
    message: "Inserisci un nome o carica una foto per identificare il campo.",
    path: ["name"],
  });

export type SubmitCourtValues = z.infer<typeof submitCourtSchema>;

/**
 * Modifica di una proposta pending (#58): stessi campi del form di invio
 * meno la posizione (immutabile) e la foto (resta quella esistente, niente
 * nuovo upload). `sport: ""` = non specificato (NULL nel DB); `hasPhoto`
 * arriva dalla riga e serve solo alla regola "nome o foto".
 */
export const pendingSubmissionSchema = z
  .object({
    name: z
      .string()
      .max(COURT_NAME_MAX, `Il nome non può superare i ${COURT_NAME_MAX} caratteri.`),
    sport: z
      .string()
      .refine(
        (v) => v === "" || (SPORT_VALUES as readonly string[]).includes(v),
        "Sport non valido."
      ),
    surface: z
      .string()
      .refine(
        (v) => (SURFACE_VALUES as readonly string[]).includes(v),
        "Superficie non valida."
      ),
    hasPhoto: z.boolean(),
  })
  .refine((d) => d.name.trim() !== "" || d.hasPhoto, {
    message: "Inserisci un nome o carica una foto per identificare il campo.",
    path: ["name"],
  });

export type PendingSubmissionValues = z.infer<typeof pendingSubmissionSchema>;

/**
 * Cambio di prodotto consapevole (d8): il DB non ha vincoli su orario e
 * numero giocatori — una lobby con orario passato è inutilizzabile, quindi
 * ora il client la blocca. Il DB resta invariato (trigger/RLS ultima difesa).
 * Range 2–30 = stesso range dell'UI precedente.
 */
export const createLobbySchema = z.object({
  startTime: z
    .string()
    .min(1, "Scegli l'orario di inizio.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Orario non valido.")
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "L'orario di inizio deve essere nel futuro."
    ),
  maxPlayers: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Inserisci un numero di giocatori valido.")
    .int("Il numero di giocatori deve essere un numero intero.")
    .min(LOBBY_MIN_PLAYERS, `Minimo ${LOBBY_MIN_PLAYERS} giocatori.`)
    .max(LOBBY_MAX_PLAYERS, `Massimo ${LOBBY_MAX_PLAYERS} giocatori.`),
  /**
   * Durata in minuti (#96, opzionale: il DB ha DEFAULT 30). Stessi bound
   * del CHECK, così il rifiuto arriva inline prima dell'INSERT.
   */
  durationMinutes: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Inserisci una durata valida.")
    .int("La durata deve essere un numero intero di minuti.")
    .min(
      LOBBY_DURATION_MIN_MINUTES,
      `Minimo ${LOBBY_DURATION_MIN_MINUTES} minuti.`
    )
    .max(
      LOBBY_DURATION_MAX_MINUTES,
      `Massimo ${LOBBY_DURATION_MAX_MINUTES} minuti.`
    )
    .optional(),
  /**
   * Sport della Lobby (#96, opzionale: NULL = ignoto). Stessa lista
   * dell'UI; il drawer lo precompila dal Campo se univoco.
   */
  sport: z.enum(SPORT_VALUES).optional(),
});

export type CreateLobbyValues = z.infer<typeof createLobbySchema>;

/** Input grezzo del form (prima della coercizione): per `useForm<Input, _, Output>`. */
export type CreateLobbyInput = z.input<typeof createLobbySchema>;

/** Regola esistente: max 30 caratteri; vuoto ammesso (azzera il nickname). */
export const editProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .max(NICKNAME_MAX, `Il nickname non può superare i ${NICKNAME_MAX} caratteri.`),
});

export type EditProfileValues = z.infer<typeof editProfileSchema>;

/**
 * Proposta di nome per un campo con nome automatico (ticket 106). Solo il nome:
 * niente sport, superficie o foto. Il confronto "uguale all'attuale" e
 * "proposta già aperta" è del client (trim + spazi collassati +
 * case-insensitive); l'indice unico parziale e il rate limit restano la
 * difesa server.
 */
export const proposeNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Scrivi il nome del campo.")
    .max(
      COURT_NAME_MAX,
      `Il nome può avere al massimo ${COURT_NAME_MAX} caratteri.`
    ),
});

export type ProposeNameValues = z.infer<typeof proposeNameSchema>;

/** Categorie = CHECK del DB (001_initial_schema); descrizione trimmata nello schema. */
export const reportSchema = z.object({
  category: z.enum(REPORT_CATEGORY_VALUES, { error: "Seleziona una categoria." }),
  description: z
    .string()
    .trim()
    .max(
      REPORT_DESCRIPTION_MAX,
      `Accorcia il testo a ${REPORT_DESCRIPTION_MAX} caratteri.`
    ),
});

export type ReportValues = z.infer<typeof reportSchema>;

export const REVIEW_BODY_MAX = 500;

/**
 * Recensione di un campo (#34). Il rating è obbligatorio (CHECK 1..5 nel DB);
 * il testo è facoltativo e viene trimmato. Lo scheletro vuoto va scritto come
 * NULL (`bodyToNull`): il CHECK della 033 rifiuta la stringa di soli spazi.
 */
export const reviewSchema = z.object({
  rating: z
    .number({ error: "Scegli quante stelle dare." })
    .int("Scegli quante stelle dare.")
    .min(1, "Scegli quante stelle dare.")
    .max(5, "Scegli quante stelle dare."),
  body: z
    .string()
    .trim()
    .max(
      REVIEW_BODY_MAX,
      `Accorcia il testo a ${REVIEW_BODY_MAX} caratteri.`
    ),
});

export type ReviewValues = z.infer<typeof reviewSchema>;

/** Bound Serie (#92): stessi del CHECK su `lobby_series` (044). */
export const SERIES_WEEKDAY_MIN = 1;
export const SERIES_WEEKDAY_MAX = 7;
export const SERIES_MAX_PLAYERS_MIN = 1;
export const SERIES_MAX_PLAYERS_MAX = 50;
/**
 * Ora del giorno `HH:MM` (i secondi si normalizzano a `:00` nel thin client
 * `lib/series/client.ts` prima dell'INSERT: la colonna è `TIME`).
 */
export const SERIES_TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Serie (#92, "il giovedì alle 20 al campo X"): regola di ripetizione, non
 * una partita. La validazione degli slug sport sta qui: il DB non ha enum
 * (`sport TEXT NULL`, `NULL` = non specificato). `active` è opzionale: il
 * default `true` del DB vale quando la chiave resta `undefined`.
 */
export const seriesSchema = z.object({
  courtId: z
    .string()
    .min(1, "Seleziona un campo.")
    .uuid("Campo non valido."),
  weekday: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Scegli il giorno della settimana.")
    .int("Scegli il giorno della settimana.")
    .min(SERIES_WEEKDAY_MIN, "Scegli il giorno della settimana.")
    .max(SERIES_WEEKDAY_MAX, "Scegli il giorno della settimana."),
  timeOfDay: z
    .string()
    .trim()
    .regex(SERIES_TIME_OF_DAY_RE, "Usa il formato HH:MM (es. 20:00)."),
  sport: z.enum(SPORT_VALUES).optional(),
  durationMinutes: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Inserisci una durata valida.")
    .int("La durata deve essere un numero intero di minuti.")
    .min(
      LOBBY_DURATION_MIN_MINUTES,
      `Minimo ${LOBBY_DURATION_MIN_MINUTES} minuti.`
    )
    .max(
      LOBBY_DURATION_MAX_MINUTES,
      `Massimo ${LOBBY_DURATION_MAX_MINUTES} minuti.`
    )
    .optional(),
  maxPlayers: z.coerce
    .number()
    .refine((v) => !Number.isNaN(v), "Inserisci un numero di giocatori valido.")
    .int("Il numero di giocatori deve essere un numero intero.")
    .min(SERIES_MAX_PLAYERS_MIN, `Minimo ${SERIES_MAX_PLAYERS_MIN} giocatore.`)
    .max(SERIES_MAX_PLAYERS_MAX, `Massimo ${SERIES_MAX_PLAYERS_MAX} giocatori.`),
  active: z.boolean().optional(),
});

export type SeriesValues = z.infer<typeof seriesSchema>;

/** Input grezzo del form (prima della coercizione): per `useForm<Input, _, Output>`. */
export type SeriesInput = z.input<typeof seriesSchema>;

/**
 * Modifica di una Serie: il creatore può cambiare la regola a piacere
 * (giorno, ora, campo); il guard del DB (044) limita già i non-creatori al
 * solo `active true → false` sulle Serie orfane. Almeno un campo, altrimenti
 * è un no-op che spreca un round-trip.
 */
export const updateSeriesSchema = seriesSchema.partial().refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  { message: "Nessuna modifica da salvare." }
);

export type UpdateSeriesValues = z.infer<typeof updateSeriesSchema>;
