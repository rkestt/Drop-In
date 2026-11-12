// Logica pura dell'opt-in push (nessun DOM, unit-testabile).
// Il componente client (`components/notifications/push-provider.tsx`) usa
// queste funzioni e tocca `Notification` / `navigator` / `localStorage`
// solo nei gestori di azione utente, mai al mount.

import type { Json } from "@/lib/supabase/database.types";

/** Chiave di persistenza dell'opt-in push esplicito. */
export const PUSH_OPT_IN_KEY = "dropin:push-optin";

export type PushSupportState =
  | "unsupported"
  | "ios-needs-install"
  | "missing-key"
  | "blocked"
  | "ready";

/**
 * Mappa lo stato del browser a un esito chiuso. L'ordine conta:
 * supporto tecnico prima, poi chiave, poi permesso, poi installazione.
 * `isStandalone` arriva dal provider gia' piegato: vale `true` anche su
 * desktop/Android, dove l'installazione non serve — quindi `false`
 * significa solo "iPhone in Safari, non installata".
 */
export function pushSupportState(input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: string;
  isStandalone: boolean;
  hasVapidKey: boolean;
}): PushSupportState {
  if (!input.hasServiceWorker || !input.hasPushManager) return "unsupported";
  if (!input.hasVapidKey) return "missing-key";
  if (input.permission === "denied") return "blocked";
  if (!input.isStandalone) return "ios-needs-install";
  return "ready";
}

/** Da base64url (chiave VAPID) a Uint8Array per `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const standard = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(standard);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** Riga da inserire in `push_subscriptions` per una subscription. */
export function subscriptionRow(
  userId: string,
  subJson: unknown,
): { user_id: string; subscription: NonNullable<Json> } {
  return { user_id: userId, subscription: subJson as NonNullable<Json> };
}

/** Opt-in letto dallo storage: solo il valore esatto `"1"` conta. */
export function readOptIn(raw: string | null): boolean {
  return raw === "1";
}

/**
 * Scrive l'opt-in ricevendo lo storage come argomento, cosi' il modulo
 * resta senza DOM. `setItem`/`removeItem` invece di `"0"`: assenza di
 * chiave = mai scelto, distinguibile da un rifiuto esplicito altrove.
 */
export function writeOptIn(
  storage: Pick<Storage, "setItem" | "removeItem">,
  value: boolean,
): void {
  if (value) {
    storage.setItem(PUSH_OPT_IN_KEY, "1");
  } else {
    storage.removeItem(PUSH_OPT_IN_KEY);
  }
}
