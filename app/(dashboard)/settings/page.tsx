import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { LocationSection } from "@/components/settings/location-section";
import { AccountSection } from "@/components/settings/account-section";
import { InfoSection } from "@/components/settings/info-section";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impostazioni",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  // Fail open like the middleware: a network error means "unknown session",
  // so bounce to login (with next) instead of 500ing — same as profile.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl("/settings", ""));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 space-y-6 p-4 pb-8">
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)]">
        Impostazioni
      </h1>
      <NotificationsSection />
      <LocationSection />
      <AccountSection
        email={user.email ?? ""}
        userId={user.id}
        nickname={profile?.nickname ?? null}
      />
      <InfoSection />
    </main>
  );
}
