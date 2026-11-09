import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { KarmaIndicator } from "@/components/karma/karma-indicator";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="flex-1 p-6">
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6">
        Profilo
      </h1>
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
            Email
          </label>
          <p className="text-[var(--text-primary)]">{user.email}</p>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
              Nickname
            </label>
            <p className="text-[var(--text-primary)]">
              {profile?.nickname || "Non impostato"}
            </p>
          </div>
          <EditProfileSheet
            userId={user.id}
            currentNickname={profile?.nickname || null}
          >
            <Button variant="ghost" size="icon">
              <Pencil className="w-4 h-4" />
            </Button>
          </EditProfileSheet>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2">
            Karma
          </label>
          <KarmaIndicator score={profile?.karma_score ?? 90} size="lg" />
        </div>
        {profile?.banned_until && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
            Sei bannato fino al{" "}
            {new Date(profile.banned_until).toLocaleString("it-IT")}
          </div>
        )}
      </div>
    </main>
  );
}
