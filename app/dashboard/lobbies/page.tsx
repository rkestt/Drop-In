import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LobbiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const { data: lobbies } = await supabase
    .from("lobbies")
    .select("*, courts(name)")
    .eq("status", "open")
    .order("start_time", { ascending: true });

  const lobbiesList = (lobbies as unknown as Array<{
    id: string;
    start_time: string;
    status: string;
    courts?: { name: string } | null;
  }> | null) ?? [];

  return (
    <main className="flex-1 p-6">
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] mb-6">
        Le tue lobby
      </h1>
      {lobbiesList.length > 0 ? (
        <ul className="space-y-3">
          {lobbiesList.map((lobby) => (
            <li
              key={lobby.id}
              className="bg-[var(--bg-surface)] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                    {lobby.courts?.name}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {new Date(lobby.start_time).toLocaleString("it-IT")}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
                {lobby.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--text-muted)]">
          Non sei ancora iscritto a nessuna lobby.
        </p>
      )}
    </main>
  );
}
