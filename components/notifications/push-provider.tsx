"use client";

import { useEffect } from "react";

export function PushNotificationProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;

    const registerPush = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) return;

        // Note: VAPID public key should come from env
        // For MVP, push notification setup requires server-side VAPID keys
        // This is a placeholder for the subscription flow
      } catch (err) {
        console.error("Push registration failed:", err);
      }
    };

    registerPush();
  }, []);

  return null;
}
