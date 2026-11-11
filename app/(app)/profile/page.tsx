import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { isBanActive } from "@/lib/profile/utils";
import { ProfileHeader } from "@/components/profile/profile-header";
import { KarmaPanel } from "@/components/profile/karma-panel";
import { StatsRow } from "@/components/profile/stats-row";
import { SettingsLinks } from "@/components/profile/settings-links";

export const dynamic = "force-dynamic";

type Counts = {
  checkIns: number | null;
  created: number | null;
  played: number | null;
};

/** Conteggio esatto; `null` se la query fallisce (mai 0 inventato). */
async function exactCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "check_ins" | "lobbies" | "lobby_participants",
  column: string,
  value: string
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    if (error) return null;
    return count;
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const supabase = await createClient();
  // Fail open like the middleware: a network error means "unknown session",
  // so bounce to login (with next) instead of 500ing.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl("/profile", ""));
  }

  const userId = user.id;

  const [profileResult, checkIns, created, played] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, karma_score, banned_until")
      .eq("user_id", userId)
      .maybeSingle(),
    exactCount(supabase, "check_ins", "user_id", userId),
    exactCount(supabase, "lobbies", "creator_id", userId),
    // UNIQUE(lobby_id, user_id): il conteggio è già distinct per lobby.
    exactCount(supabase, "lobby_participants", "user_id", userId),
  ]);

  const profile = profileResult.data;
  const nickname = profile?.nickname ?? null;
  const karma = profile?.karma_score ?? 90;
  const bannedUntil = profile?.banned_until ?? null;
  const banned = isBanActive(bannedUntil);

  const counts: Counts = { checkIns, created, played };

  return (
    <main id="contenuto" tabIndex={-1} className="flex-1 w-full max-w-[720px] mx-auto p-4 flex flex-col gap-3.5">
      <h1 className="font-display text-2xl font-bold m-0">Profilo</h1>

      <ProfileHeader userId={userId} nickname={nickname} email={user.email ?? null} />

      {banned && (
        <div
          role="status"
          className="flex gap-2.5 items-start rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4"
        >
          <span aria-hidden="true" className="inline-flex shrink-0 mt-0.5 text-[var(--danger)]">
            <TriangleAlert className="w-5 h-5" />
          </span>
          <div>
            <p className="m-0 text-base font-bold text-[var(--text-primary)]">
              Partecipazione sospesa
            </p>
            <p className="m-0 mt-0.5 leading-snug text-[var(--text-primary)]">
              Karma sotto 50: puoi partecipare di nuovo dal{" "}
              <strong>
                {new Date(bannedUntil as string).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              .
            </p>
            <p className="m-0 mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">
              Nel frattempo puoi consultare i campi e le tue lobby.
            </p>
          </div>
        </div>
      )}

      <KarmaPanel score={karma} banned={banned} />

      <StatsRow checkIns={counts.checkIns} created={counts.created} played={counts.played} />

      <SettingsLinks />
    </main>
  );
}
