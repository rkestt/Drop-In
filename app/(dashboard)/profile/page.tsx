import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { KarmaIndicator } from "@/components/karma/karma-indicator";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

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
