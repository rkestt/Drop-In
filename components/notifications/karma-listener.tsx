"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { initKarmaSubscription } from "@/components/notifications/karma-subscription";

// Ascolta gli update della riga `profiles` e li traduce in toast Sonner.
// Non renderizza markup: chiama solo `toast`. Se l'utente non è loggato,
// non apre alcun canale Realtime.
export function KarmaListener() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => initKarmaSubscription(supabase), [supabase]);

  return null;
}
