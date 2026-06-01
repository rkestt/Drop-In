"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, X } from "lucide-react";

interface Toast {
  id: string;
  type: "karma_drop" | "ban_applied";
  message: string;
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (channelRef.current) return;

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
          (payload: any) => {
            const old = payload.old as Record<string, unknown>;
            const newV = payload.new as Record<string, unknown>;

            const oldKarma = old.karma_score ?? 90;
            const newKarma = newV.karma_score ?? oldKarma;
            const oldBan = old.banned_until ?? null;
            const newBan = newV.banned_until ?? null;

            // Karma decreased
            if (newKarma < oldKarma) {
              const diff = (oldKarma as number) - (newKarma as number);
              const id = `karma-${Date.now()}`;
              setToasts((prev) => [
                ...prev,
                {
                  id,
                  type: "karma_drop",
                  message: `Hai perso ${diff} punto${diff > 1 ? "i" : ""} Karma (${newKarma})`,
                },
              ]);
              setTimeout(() => removeToast(id), 5000);
            }

            // Ban applied
            if (!oldBan && newBan) {
              const id = `ban-${Date.now()}`;
              setToasts((prev) => [
                ...prev,
                {
                  id,
                  type: "ban_applied",
                  message: `Sei stato bannato fino al ${new Date(newBan as string).toLocaleString("it-IT")}`,
                },
              ]);
              setTimeout(() => removeToast(id), 8000);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 max-w-md mx-auto pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border transition-all duration-300 ${
            toast.type === "ban_applied"
              ? "bg-[var(--danger)]/10 border-[var(--danger)]/20"
              : "bg-[var(--warning)]/10 border-[var(--warning)]/20"
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              toast.type === "ban_applied"
                ? "text-[var(--danger)]"
                : "text-[var(--warning)]"
            }`}
          />
          <p
            className={`flex-1 text-sm font-medium ${
              toast.type === "ban_applied"
                ? "text-[var(--danger)]"
                : "text-[var(--warning)]"
            }`}
          >
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}