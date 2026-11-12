"use client";

// Opt-in push reale: permesso solo su azione utente, mai al mount.
// Al mount legge solo la subscription esistente e imposta lo stato; se la
// chiave VAPID manca o il browser non supporta la push, lo stato lo spiega
// e la UI resta spenta (mai crash, mai prompt).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { isIosDevice, isStandaloneDisplayMode } from "@/lib/pwa/install";
import {
  pushSupportState,
  readOptIn,
  subscriptionRow,
  urlBase64ToUint8Array,
  writeOptIn,
  type PushSupportState,
} from "@/lib/push/subscribe";

export type PushUiState =
  | Exclude<PushSupportState, "ready">
  | "on"
  | "off"
  | "checking";

interface PushContextValue {
  state: PushUiState;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

const PushContext = createContext<PushContextValue | null>(null);

export function usePushNotifications(): PushContextValue {
  const value = useContext(PushContext);
  if (!value) {
    throw new Error("usePushNotifications va usato dentro PushProvider.");
  }
  return value;
}

function vapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.trim() !== "" ? key : null;
}

/**
 * `true` dove la push puo' funzionare senza installazione (desktop e
 * Android): `pushSupportState` riceve `false` solo per "iPhone in Safari,
 * non installata", l'unico caso che richiede davvero l'installazione
 * (iOS 16.4+, solo da PWA installata).
 */
function isStandaloneForPush(): boolean {
  try {
    if (isStandaloneDisplayMode(window.matchMedia("(display-mode: standalone)").matches)) {
      return true;
    }
    if ((window.navigator as { standalone?: boolean }).standalone === true) {
      return true;
    }
    return !isIosDevice(window.navigator.userAgent);
  } catch {
    return false;
  }
}

function currentPermission(): string {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

function readStoredOptIn(): boolean {
  try {
    return readOptIn(window.localStorage.getItem("dropin:push-optin"));
  } catch {
    return false;
  }
}

function storeOptIn(value: boolean): void {
  try {
    writeOptIn(window.localStorage, value);
  } catch {
    // Storage non disponibile (navigazione privata): l'opt-in resta solo
    // nella subscription del browser, lo stato resta comunque onesto.
  }
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<PushUiState>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const support = pushSupportState({
        hasServiceWorker: "serviceWorker" in navigator,
        hasPushManager: "PushManager" in window,
        permission: currentPermission(),
        isStandalone: isStandaloneForPush(),
        hasVapidKey: vapidPublicKey() !== null,
      });
      if (support !== "ready") {
        if (!cancelled) setState(support);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          if (!existing && readStoredOptIn()) {
            // Flag orfano (dati browser cancellati): si riallinea.
            storeOptIn(false);
          }
          setState(existing ? "on" : "off");
        }
      } catch {
        if (!cancelled) setState("off");
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Questo browser non supporta le notifiche push.");
    }
    const key = vapidPublicKey();
    if (!key) {
      throw new Error("Le notifiche push non sono configurate.");
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setState("blocked");
        throw new Error(
          permission === "denied"
            ? "Hai bloccato le notifiche: riattivale dalle impostazioni del browser."
            : "Permesso non concesso.",
        );
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        await subscription.unsubscribe().catch(() => {});
        throw new Error("Accedi per attivare le notifiche push.");
      }
      const { error } = await supabase.from("push_subscriptions").upsert(
        subscriptionRow(user.id, subscription.toJSON()),
        { onConflict: "user_id,subscription", ignoreDuplicates: true },
      );
      if (error) {
        await subscription.unsubscribe().catch(() => {});
        throw new Error("Attivazione non riuscita, riprova.");
      }
      storeOptIn(true);
      setState("on");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const subJson = existing.toJSON();
          await existing.unsubscribe().catch(() => {});
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("subscription", subJson as NonNullable<Json>);
          }
        }
      }
      storeOptIn(false);
      setState(currentPermission() === "denied" ? "blocked" : "off");
    } finally {
      setBusy(false);
    }
  }, [supabase]);

  const value = useMemo(
    () => ({ state, busy, enable, disable }),
    [state, busy, enable, disable],
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}
