/**
 * Dizionario delle stringhe core (#64): nav, auth, azioni, errori, a11y.
 *
 * Regole:
 * - `it` è la fonte di verità: `en` deve avere esattamente le stesse chiavi
 *   (lo impone il tipo `Record<MessageKey, string>`, lo verifica un test).
 * - Qui solo stringhe brevi e riusabili. Testi lunghi (legale, onboarding,
 *   copy di prodotto) restano nei componenti finché non c'è il routing.
 * - Segnaposto `{name}` interpolati da `translate`. Niente concatenazioni a
 *   mano nei componenti: l'ordine delle parole cambia tra le lingue.
 */

export const it = {
  "nav.map": "Mappa",
  "nav.profile": "Profilo",
  "nav.lobbies": "Lobby",
  "nav.notifications": "Notifiche",
  "nav.mapAria": "Mappa campi",
  "nav.profileAria": "Profilo utente",

  "auth.signIn": "Accedi",
  "auth.signOut": "Esci",
  "auth.signUp": "Registrati",
  "auth.email": "Indirizzo email",
  "auth.password": "Password",
  "auth.forgotPassword": "Password dimenticata?",
  "auth.showPassword": "Mostra password",
  "auth.hidePassword": "Nascondi password",
  "auth.loginRequired": "Accedi per continuare.",
  "auth.sessionExpired": "Sessione scaduta: accedi di nuovo.",

  "action.save": "Salva",
  "action.cancel": "Annulla",
  "action.close": "Chiudi",
  "action.retry": "Riprova",
  "action.delete": "Elimina",
  "action.confirm": "Conferma",

  "error.generic": "Qualcosa è andato storto.",
  "error.network": "Controlla la connessione e riprova.",
  "error.rateLimited": "Troppe richieste: riprova tra poco.",
  "error.validation": "Controlla i campi evidenziati.",

  "a11y.skipToContent": "Vai al contenuto",
  "a11y.loading": "Caricamento…",
  "a11y.closeDialog": "Chiudi la finestra",

  "checkin.action": "Check-in",
  "checkin.checkedIn": "Check-in fatto",
  "lobby.join": "Unisciti",
  "lobby.leave": "Esci dalla lobby",
  "review.submit": "Pubblica recensione",
  "review.title": "Recensioni",

  "empty.favorites": "Non hai ancora salvato campi.",
  "empty.notifications": "Nessuna notifica.",
} as const;

export type MessageKey = keyof typeof it;

export const en: Record<MessageKey, string> = {
  "nav.map": "Map",
  "nav.profile": "Profile",
  "nav.lobbies": "Lobbies",
  "nav.notifications": "Notifications",
  "nav.mapAria": "Courts map",
  "nav.profileAria": "User profile",

  "auth.signIn": "Sign in",
  "auth.signOut": "Sign out",
  "auth.signUp": "Sign up",
  "auth.email": "Email address",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot your password?",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.loginRequired": "Sign in to continue.",
  "auth.sessionExpired": "Session expired: sign in again.",

  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.close": "Close",
  "action.retry": "Retry",
  "action.delete": "Delete",
  "action.confirm": "Confirm",

  "error.generic": "Something went wrong.",
  "error.network": "Check your connection and try again.",
  "error.rateLimited": "Too many requests: try again shortly.",
  "error.validation": "Check the highlighted fields.",

  "a11y.skipToContent": "Skip to content",
  "a11y.loading": "Loading…",
  "a11y.closeDialog": "Close dialog",

  "checkin.action": "Check in",
  "checkin.checkedIn": "Checked in",
  "lobby.join": "Join",
  "lobby.leave": "Leave lobby",
  "review.submit": "Post review",
  "review.title": "Reviews",

  "empty.favorites": "You haven't saved any courts yet.",
  "empty.notifications": "No notifications.",
};

export const messages = { it, en } as const;
