"use client";

import { useEffect, useState } from "react";

export function DevSwReset() {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // Check if we're in development mode (client-side check)
    const checkDev = () => {
      const dev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      setIsDev(dev);
      return dev;
    };

    if (!checkDev()) return;

    const resetSw = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }

        // Register fresh dev sw with cache-bust query
        const swUrl = "/dev-sw.js?" + Date.now();
        await navigator.serviceWorker.register(swUrl, { scope: "/" });

        console.log("Dev SW registered:", swUrl);
      } catch (err) {
        console.error("SW reset failed:", err);
      }
    };

    // Reset on every page load in dev
    resetSw();
  }, []);

  if (!isDev) return null;

  return null;
}