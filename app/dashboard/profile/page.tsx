import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { KarmaSection } from "@/components/profile/karma-section";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  LogOut,
  Settings,
  MapPin,
  Users,
  Calendar,
  AlertTriangle,
  Sparkles,
  Volleyball,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileStats {
  totalCheckIns: number;
  totalLobbies: number;
  noShows: number;
}

async function getProfileStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ProfileStats> {
  const { count: totalCheckIns } = await supabase
    .from("check_ins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: totalLobbies } = await supabase
    .from("lobby_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

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

async function getRecentActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("check_ins")
    .select(`
      id,
      checked_in_at,
      lobby_id,
      lobbies:courts!inner(
        name,
        address
      )
    `)
    .eq("user_id", userId)
    .not("lobby_id", "is", null)
    .order("checked_in_at", { ascending: false })
    .limit(6);

  return (data ?? []).map((d: any) => ({
    id: d.id,
    checked_in_at: d.checked_in_at,
    court_name: d.lobbies?.name ?? "Campo",
    court_address: d.lobbies?.address ?? "",
    lobby_type: "partita",
    lobby_id: d.lobby_id,
  }));
}

async function handleLogout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function timeAgo(dateStr: string): string {
  try {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "pochi secondi fa";
    if (diffMins < 60)
      return `${diffMins} ${diffMins === 1 ? "minuto" : "minuti"} fa`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
    if (diffDays < 7)
      return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
    return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  } catch {
    return "recentemente";
  }
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

  const [stats, recentActivity] = await Promise.all([
    getProfileStats(supabase, user.id),
    getRecentActivity(supabase, user.id),
  ]);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const needsCompletion = !profile?.nickname || !profile?.avatar_url;
  const initials = (
    profile?.nickname || user.email?.[0] || "?"
  )[0].toUpperCase();
  const reliability =
    stats.totalLobbies > 0
      ? Math.round(
          ((stats.totalLobbies - stats.noShows) / stats.totalLobbies) * 100
        )
      : 100;

  return (
    <main className="px-4 pt-5 pb-8">
      {/* Mobile container: centered + max-width on small screens */}
      <div className="max-w-[720px] mx-auto">
        {/* Page title */}
        <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6 animate-fade-in">
          Profilo
        </h1>

        {/* ── Row 1: Profile + Karma (side by side on desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-4 mb-4 min-w-0">
          {/* Card Profilo */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5 animate-fade-in overflow-hidden">
            {needsCompletion && (
              <EditProfileSheet
                userId={user.id}
                currentNickname={profile?.nickname || null}
                currentAvatar={profile?.avatar_url || null}
              >
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20 group cursor-pointer hover:bg-[var(--accent-subtle)]/80 transition-colors">
                  <Sparkles className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--accent)]">
                      Completa il profilo
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {!profile?.nickname && !profile?.avatar_url
                        ? "Aggiungi nickname e foto"
                        : !profile?.nickname
                          ? "Aggiungi un nickname"
                          : "Aggiungi una foto"}
                    </p>
                  </div>
                </div>
              </EditProfileSheet>
            )}

            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border-2 border-[var(--cool-muted)]/20"
                style={{
                  background: profile?.avatar_url
                    ? `url(${profile.avatar_url}) center/cover no-repeat`
                    : undefined,
                }}
              >
                {!profile?.avatar_url && (
                  <span className="text-3xl font-bold text-[var(--accent)] font-[family-name:var(--font-syne)]">
                    {initials}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2 min-w-0 overflow-hidden">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)] truncate">
                      {profile?.nickname || "Anonimo"}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] truncate">
                      {user.email}
                    </p>
                    {memberSince && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                        <p className="text-xs text-[var(--text-muted)]">
                          Membro dal{" "}
                          <span className="font-medium text-[var(--text-secondary)]">
                            {memberSince}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <EditProfileSheet
                      userId={user.id}
                      currentNickname={profile?.nickname || null}
                      currentAvatar={profile?.avatar_url || null}
                    >
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </EditProfileSheet>

                    <Link href="/dashboard/account">
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </Link>

                    <form action={handleLogout}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        type="submit"
                        title="Esci"
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Karma */}
          <KarmaSection
            score={profile?.karma_score ?? 90}
            className="animate-fade-in"
          />
        </div>

        {/* ── Ban banner ── */}
        {profile?.banned_until && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--danger)]/10 text-[var(--danger)] text-sm flex items-start gap-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Account sospeso fino al{" "}
              {new Date(profile.banned_until).toLocaleString("it-IT")}
            </span>
          </div>
        )}

        {/* ── Row 2: Statistiche ── */}
        <div className="bg-[var(--bg-surface)] rounded-xl p-4 sm:p-5 mb-4 animate-fade-in overflow-hidden">
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-4">
            Statistiche
          </label>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[var(--bg-elevated)] rounded-xl p-3 text-center">
              <MapPin className="w-5 h-5 mx-auto mb-1.5 text-[var(--accent)]" />
              <p className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                {stats.totalCheckIns}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Check-in</p>
            </div>
            <Link
              href="/dashboard/lobbies"
              className="bg-[var(--bg-elevated)] rounded-xl p-3 text-center block hover:bg-[var(--accent-subtle)]/50 transition-colors"
            >
              <Users className="w-5 h-5 mx-auto mb-1.5 text-[var(--accent)]" />
              <p className="text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
                {stats.totalLobbies}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Partite</p>
            </Link>
            <div
              className={cn(
                "bg-[var(--bg-elevated)] rounded-xl p-3 text-center",
                stats.noShows > 0 && "ring-1 ring-[var(--warning)]/20"
              )}
            >
              <AlertTriangle
                className={cn(
                  "w-5 h-5 mx-auto mb-1.5",
                  stats.noShows > 0
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-muted)]"
                )}
              />
              <p
                className={cn(
                  "text-2xl font-bold font-[family-name:var(--font-syne)]",
                  stats.noShows > 0
                    ? "text-[var(--warning)]"
                    : "text-[var(--text-primary)]"
                )}
              >
                {stats.noShows}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">No-show</p>
            </div>
          </div>

          {/* Affidabilità */}
          {stats.totalLobbies > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0">
                Affidabilità
              </span>
              <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    reliability >= 90
                      ? "bg-[var(--success)]"
                      : reliability >= 70
                        ? "bg-[var(--warning)]"
                        : "bg-[var(--danger)]"
                  )}
                  style={{ width: `${reliability}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-sm font-bold font-[family-name:var(--font-syne)] tabular-nums w-10 text-right flex-shrink-0",
                  reliability >= 90
                    ? "text-[var(--success)]"
                    : reliability >= 70
                      ? "text-[var(--warning)]"
                      : "text-[var(--danger)]"
                )}
              >
                {reliability}%
              </span>
            </div>
          )}
        </div>

        {/* ── Row 3: Attività recente ── */}
        <div className="bg-[var(--bg-surface)] rounded-xl p-4 sm:p-5 animate-fade-in overflow-hidden">
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-4">
            Attività recente
          </label>

          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                <Volleyball className="w-7 h-7 text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  Nessuna partita ancora
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-[220px] mx-auto leading-relaxed">
                  Unisciti alla tua prima partita per vederla qui!
                </p>
              </div>
              <Link
                href="/"
                className="mt-1 text-xs text-[var(--accent)] font-medium hover:underline"
              >
                Trova un campo
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentActivity.map((item) => (
                <a
                  key={item.id}
                  href={`/courts/${item.lobby_id}`}
                  className="group flex items-start gap-3 p-4 bg-[var(--bg-elevated)] rounded-xl hover:bg-[var(--accent-subtle)]/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                    <Volleyball className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {item.court_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">
                        {timeAgo(item.checked_in_at)}
                      </span>
                    </div>
                    {item.court_address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-[var(--text-muted)] flex-shrink-0" />
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {item.court_address}
                        </p>
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}