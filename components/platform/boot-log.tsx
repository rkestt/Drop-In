"use client";

import { useEffect } from "react";
import { createLogger, supabaseUrlHost } from "@/lib/logger";

// Log di avvio: una sola riga a livello info (visibile con il livello
// "Info" di default in DevTools). Fuori dal render path: non emette DOM.
export function BootLog() {
  useEffect(() => {
    const logger = createLogger("boot");
    const nodeEnv =
      typeof process !== "undefined" && process.env?.NODE_ENV
        ? process.env.NODE_ENV
        : "unknown";
    const supabaseHost = supabaseUrlHost(
      typeof process !== "undefined"
        ? process.env?.NEXT_PUBLIC_SUPABASE_URL
        : undefined,
    );
    const mapProvider =
      typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MAP_PROVIDER
        ? process.env.NEXT_PUBLIC_MAP_PROVIDER
        : "unset";
    const configuredLevel =
      typeof process !== "undefined"
        ? process.env?.NEXT_PUBLIC_LOG_LEVEL
        : undefined;
    const suffix = configuredLevel ? ` logLevel=${configuredLevel}` : "";
    logger.info(
      `env=${nodeEnv} supabase=${supabaseHost} map=${mapProvider}${suffix}`,
    );
  }, []);
  return null;
}
