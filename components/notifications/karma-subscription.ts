import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";
import {
  profileChangeEvents,
  type ProfileKarmaState,
} from "@/components/notifications/karma-events";

// Apre il canale Realtime sulla riga `profiles` dell'utente e traduce gli
// UPDATE in toast Sonner. Ritorna la funzione di cleanup.
//
// Anti-leak: `getUser()` è async, quindi l'unmount (o il remount di StrictMode
// in dev) può avvenire prima che il channel esista. Il flag `cancelled`
// impedisce di aprire un channel orfano dopo la cleanup; se il channel esiste
// già, viene rimosso.
export function initKarmaSubscription(
  client: SupabaseClient<Database>
): () => void {
  let cancelled = false;
  let channel: RealtimeChannel | null = null;

  client.auth.getUser().then(({ data: { user } }) => {
    if (cancelled || !user) return;

    channel = client
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
  });

  return () => {
    cancelled = true;
    if (channel) {
      client.removeChannel(channel);
    }
  };
}
