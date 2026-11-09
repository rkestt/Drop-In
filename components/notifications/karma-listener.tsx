"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  profileChangeEvents,
  type ProfileKarmaState,
} from "@/components/notifications/karma-events";

// Ascolta gli update della riga `profiles` e li traduce in toast Sonner.
// Non renderizza markup: chiama solo `toast`. Se l'utente non è loggato,
// non apre alcun canale Realtime.
export function KarmaListener() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`profile-toast-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const oldProfile = payload.old as ProfileKarmaState;
            const newProfile = payload.new as ProfileKarmaState;

            for (const event of profileChangeEvents(oldProfile, newProfile)) {
              if (event.kind === "karma_drop") {
                toast.warning(event.title, {
                  id: event.id,
                  description: event.description,
                });
              } else if (event.kind === "ban_applied") {
                toast.error(event.title, {
                  id: event.id,
                  description: event.description,
                });
              } else {
                toast.success(event.title, {
                  id: event.id,
                  description: event.description,
                });
              }
            }
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    };

    init();

    return () => {
      cleanup?.();
    };
  }, [supabase]);

  return null;
}
