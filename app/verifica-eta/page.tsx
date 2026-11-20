import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedAgeGateStatus } from "@/lib/profile/age-gate";
import { VerificaEtaClient } from "./verifica-eta-client";

// /verifica-eta (#97): fuori dai gruppi (app)/(dashboard) — niente bottom nav
// né header dashboard, la schermata blocca. Anonimo o già verificato → "/".
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verifica l'età",
};

export default async function VerificaEtaPage() {
  const supabase = await createClient();
  const { userId, verified } = await getCachedAgeGateStatus(supabase);
  if (!userId || verified) redirect("/");
  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] flex-1 flex-col px-4 py-8"
    >
      <VerificaEtaClient userId={userId} />
    </main>
  );
}
