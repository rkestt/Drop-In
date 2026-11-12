import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { sportDisplayLabel } from "@/lib/courts/search";

export const dynamic = "force-dynamic";

interface FavoriteRow {
  created_at: string;
  courts: {
    id: string;
    name: string;
    address: string | null;
    sport: string | null;
    photo_path: string | null;
  } | null;
}

/**
 * Campi salvati (#22): lista dei preferiti dell'utente, piu' recenti prima.
 * Stesso redirect login di /profile; card come i risultati della home.
 */
export default async function FavoritesPage() {
  const supabase = await createClient();
  // Fail open come /profile: errore di rete = sessione ignota -> login.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl("/favorites", ""));
  }

  let favorites: FavoriteRow[] = [];
  try {
    const { data } = await supabase
      .from("user_favorites")
      .select("created_at, courts (id, name, address, sport, photo_path)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (Array.isArray(data)) {
      favorites = (data as unknown as FavoriteRow[]).filter(
        (row) => row.courts != null
      );
    }
  } catch {
    favorites = [];
  }

  return (
    <main
      id="contenuto"
      tabIndex={-1}
      className="flex-1 w-full max-w-[720px] mx-auto p-4 space-y-4"
    >
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold m-0">Campi salvati</h1>
        {favorites.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {favorites.length === 1
              ? "1 campo salvato"
              : `${favorites.length} campi salvati`}
          </p>
        )}
      </header>

      {favorites.length === 0 ? (
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
          <Heart
            className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-secondary)]">
            Nessun campo salvato. Tocca il cuore su un campo per ritrovarlo
            qui.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-[var(--accent)] no-underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            Torna alla mappa
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {favorites.map((row) => {
            const court = row.courts as NonNullable<FavoriteRow["courts"]>;
            const sport = sportDisplayLabel(court.sport);
            // Stessa riga di metadati dei risultati della home: il punto
            // resta attaccato alla voce precedente (NBSP) se il testo va a
            // capo a 360px.
            const meta = court.address
              ? `${sport}\u00A0· ${court.address}`
              : sport;
            return (
              <li key={court.id}>
                <Link
                  href={`/courts/${court.id}`}
                  className="flex min-h-[44px] items-center gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <CourtPhotoThumb
                    photoPath={court.photo_path}
                    className="h-14 w-14"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--text-primary)]">
                      {court.name}
                    </span>
                    <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                      {meta}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
