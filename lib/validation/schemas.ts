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
export const LOBBY_MIN_PLAYERS = 2;
export const LOBBY_MAX_PLAYERS = 30;

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

/** Regole esistenti: orario futuro, 2–30 giocatori (stesso range dell'UI). */
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

/** Categorie = CHECK del DB (001_initial_schema); descrizione libera. */
export const reportSchema = z.object({
  category: z.enum(REPORT_CATEGORY_VALUES, { error: "Seleziona una categoria." }),
  description: z.string(),
});

export type ReportValues = z.infer<typeof reportSchema>;
