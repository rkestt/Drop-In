"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Campanella con conteggio reale delle non lette (d22, prototipo d14:
// "Campanella in mappa e profilo"). Nulla se l'utente non è loggato.
// Il conteggio si aggiorna via realtime e sull'evento
// `notifications:changed` emesso dalla lista dopo tap/segna-tutte.
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async (id: string) => {
      const { count } = await supabase
        .from("push_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .is("read_at", null);
      if (active) setUnread(count ?? 0);
    };

    const setup = (id: string | null) => {
      if (!active) return;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      setUserId(id);
      if (!id) {
        setUnread(0);
        return;
      }
      void refresh(id);
      channel = supabase
        .channel(`push-notifications-bell-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "push_notifications",
            filter: `user_id=eq.${id}`,
          },
          () => void refresh(id)
        )
        .subscribe();
    };

    const onChanged = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) void refresh(user.id);
      });
    };
    window.addEventListener("notifications:changed", onChanged);

    supabase.auth.getUser().then(({ data: { user } }) => {
      setup(user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setup(session?.user?.id ?? null);
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("notifications:changed", onChanged);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  if (!userId) return null;

  const label =
    unread > 0
      ? `Notifiche, ${unread} non ${unread === 1 ? "letta" : "lette"}`
      : "Notifiche";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative grid place-items-center w-11 h-11 rounded-control bg-[var(--bg-surface)] border border-[var(--cool-muted)]/20 text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <Bell aria-hidden="true" className="w-5 h-5" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-chip bg-[var(--accent)] text-[var(--accent-foreground)] text-label font-bold leading-none border-2 border-[var(--bg-base)]"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
