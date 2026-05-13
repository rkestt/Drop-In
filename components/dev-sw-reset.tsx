"use client";

import { useEffect, useState } from "react";

export function DevSwReset() {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
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

        const swUrl = "/dev-sw.js?" + Date.now();
        const reg = await navigator.serviceWorker.register(swUrl, { scope: "/" });

        reg.addEventListener('updatefound', () => {
          const newSw = reg.installing;
          if (newSw) {
            newSw.addEventListener('statechange', () => {
              if (newSw.state === 'activated') {
                // Cache the current page for offline use
                caches.open('dev-dropin-' + DEV_SW_VERSION).then((cache) => {
                  cache.add(window.location.href);
                });
              }
            });
          }
        });

        console.log("Dev SW registered:", swUrl);
      } catch (err) {
        console.error("SW reset failed:", err);
      }
    };

    resetSw();
  }, []);

  if (!isDev) return null;

  return null;
}

const DEV_SW_VERSION = 'dev-v4';