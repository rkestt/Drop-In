import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { KarmaIndicator } from "@/components/karma/karma-indicator";
import { Button } from "@/components/ui/button";
import { Pencil, LogOut, MapPin, Users, Calendar, AlertTriangle } from "lucide-react";

interface ProfileStats {
  totalCheckIns: number;
  totalLobbies: number;
  noShows: number;
}

async function getProfileStats(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<ProfileStats> {
  // Check-ins totali
  const { count: totalCheckIns } = await supabase
    .from("check_ins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Lobby a cui si è partecipato
  const { count: totalLobbies } = await supabase
    .from("lobby_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // No-show: lobby chiuse in cui l'utente era iscritto ma non ha check-in
  // (lobby_participants exists but no check_ins for that lobby_id)
  const { data: participatedLobbies } = await supabase
    .from("lobby_participants")
    .select("lobby_id")
    .eq("user_id", userId);

  const lobbyIds = participatedLobbies?.map((p) => p.lobby_id) ?? [];

  let noShows = 0;
  if (lobbyIds.length > 0) {
    const { data: checkedIns } = await supabase
      .from("check_ins")
      .select("lobby_id")
      .eq("user_id", userId)
      .in("lobby_id", lobbyIds)
      .not("lobby_id", "is", null);

    const checkedLobbyIds = new Set(checkedIns?.map((c) => c.lobby_id) ?? []);
    noShows = lobbyIds.filter((id) => !checkedLobbyIds.has(id)).length;
  }

  return {
    totalCheckIns: totalCheckIns ?? 0,
    totalLobbies: totalLobbies ?? 0,
    noShows,
  };
}

async function handleLogout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const stats = await getProfileStats(supabase, user.id);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="flex-1 p-6">
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6">
        Profilo
      </h1>

      {/* Header: avatar + info base */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          {/* Avatar grande */}
          <div
            className="w-20 h-20 rounded-full overflow-hidden bg-[var(--accent)]/20 flex-shrink-0 flex items-center justify-center border-2 border-[var(--border)]"
            style={
              profile?.avatar_url
                ? { background: `url(${profile.avatar_url}) center/cover no-repeat` }
                : undefined
            }
          >
            {!profile?.avatar_url && (
              <span className="text-3xl font-bold text-[var(--accent)] font-[family-name:var(--font-syne)]">
                {(profile?.nickname || user.email?.[0] || "?")[0].toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] truncate">
                  {profile?.nickname || "Anonimo"}
                </h2>
                <p className="text-sm text-[var(--text-muted)] truncate">{user.email}</p>
                {memberSince && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Membro dal {memberSince}
                  </p>
                )}
              </div>
              <EditProfileSheet
                userId={user.id}
                currentNickname={profile?.nickname || null}
                currentAvatar={profile?.avatar_url || null}
              >
                <Button variant="ghost" size="icon">
                  <Pencil className="w-4 h-4" />
                </Button>
              </EditProfileSheet>
            </div>
          </div>
        </div>
      </div>

      {/* Karma */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 mb-4">
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-3">
          Karma
        </label>
        <KarmaIndicator score={profile?.karma_score ?? 90} size="lg" />
        {profile?.banned_until && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Bannato fino al{" "}
              {new Date(profile.banned_until).toLocaleString("it-IT")}
            </span>
          </div>
        )}
      </div>

      {/* Statistiche */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 mb-4">
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-3">
          Statistiche
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
            <MapPin className="w-5 h-5 mx-auto mb-1 text-[var(--accent)]" />
            <p className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
              {stats.totalCheckIns}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Check-in</p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-[var(--accent)]" />
            <p className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
              {stats.totalLobbies}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Partite</p>
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
            <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${stats.noShows > 0 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`} />
            <p className={`text-2xl font-bold font-[family-name:var(--font-syne)] ${stats.noShows > 0 ? "text-[var(--warning)]" : "text-[var(--text-primary)]"}`}>
              {stats.noShows}
            </p>
            <p className="text-xs text-[var(--text-muted)]">No-show</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5">
        <form action={handleLogout}>
          <Button type="submit" variant="secondary" className="w-full gap-2">
            <LogOut className="w-4 h-4" />
            Esci
          </Button>
        </form>
      </div>
    </main>
  );
}
