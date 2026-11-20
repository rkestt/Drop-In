import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedAgeGateStatus } from "@/lib/profile/age-gate";
import { AppShell } from "./app-shell";

// Gate età (#97): sessione senza riga `profile_age` → /verifica-eta.
// Senza sessione niente cambia (browse-first: anon resta libero).
// /verifica-eta vive fuori dal gruppo: niente loop. Server component:
// il chrome client (nav/bottom) è in `app-shell.tsx`.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { userId, verified } = await getCachedAgeGateStatus(supabase);
  if (userId && !verified) redirect("/verifica-eta");
  return <AppShell>{children}</AppShell>;
}
