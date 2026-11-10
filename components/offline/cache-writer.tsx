"use client";

import { useEffect } from "react";
import { writeCache } from "@/lib/offline/cache";

/** Scrive un valore in cache al mount (per le pagine server dopo fetch buona). */
export function CacheWriter({
  storageKey,
  value,
}: {
  storageKey: string;
  value: unknown;
}) {
  useEffect(() => {
    writeCache(storageKey, value);
  }, [storageKey, value]);
  return null;
}
