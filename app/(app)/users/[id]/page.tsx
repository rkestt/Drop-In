import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Users, Trophy } from "lucide-react";
import type { Metadata } from "next";

interface PublicProfile {
  nickname: string | null;
  avatar_url: string | null;
  karma_score: number | null;
  total_check_ins: number | null;
  total_lobbies_participated: number | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await (supabase.rpc as any)("get_public_profile", {
    p_user_id: id,
  });

  const profile = (data?.[0] as PublicProfile | undefined) || null;
  const nickname = profile?.nickname || "Utente";

  return {
    title: `${nickname} — Profilo pubblico | Drop-In`,
    description: `Profilo di ${nickname} su Drop-In. Karma: ${profile?.karma_score ?? "N/A"}.`,
    openGraph: {
      title: `${nickname} — Drop-In`,
      description: `Profilo pubblico di ${nickname}`,
      type: "profile",
    },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await (supabase.rpc as any)("get_public_profile", {
    p_user_id: id,
  });

  const profile = (data?.[0] as PublicProfile | undefined) || null;

  if (!profile) {
    notFound();
  }

  return (
    <main className="min-h-full bg-[var(--bg-base)]">
      <div className="max-w-[720px] mx-auto px-4 py-6 space-y-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla mappa
        </Link>

        {/* Profile header */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[var(--bg-elevated)] border-2 border-[var(--accent)]">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.nickname || "Avatar"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-3xl font-bold">
                {(profile.nickname || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
              {profile.nickname || "Utente anonimo"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Membro di Drop-In
            </p>
          </div>

          {/* Karma badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-sm font-medium">
            <Trophy className="w-4 h-4" />
            Karma {profile.karma_score ?? 0}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <MapPin className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">
                Check-in
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
              {profile.total_check_ins ?? 0}
            </p>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Users className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">
                Lobby
              </span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-syne)]">
              {profile.total_lobbies_participated ?? 0}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
