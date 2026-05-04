"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";

interface BanBannerProps {
  userId: string;
}

export function BanBanner({ userId }: BanBannerProps) {
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const [karmaScore, setKarmaScore] = useState<number>(90);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("banned_until, karma_score")
        .eq("user_id", userId)
        .single();

      if (data) {
        setBannedUntil(data.banned_until);
        setKarmaScore(data.karma_score);
      }
    };

    fetchProfile();

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setBannedUntil(payload.new.banned_until);
          setKarmaScore(payload.new.karma_score);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  if (bannedUntil && new Date(bannedUntil) > new Date()) {
    return (
      <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[var(--danger)]">Account bannato</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Non puoi creare o partecipare a lobby fino al{" "}
            {new Date(bannedUntil).toLocaleString("it-IT")}
          </p>
        </div>
      </div>
    );
  }

  if (karmaScore < 60) {
    return (
      <div className="bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-xl p-4">
        <p className="text-sm text-[var(--warning)]">
          Il tuo Karma è basso ({karmaScore}). Se scende sotto 50 sarai bannato
          per 7 giorni.
        </p>
      </div>
    );
  }

  return null;
}
