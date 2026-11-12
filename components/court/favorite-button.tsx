"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LoginModal } from "@/components/auth/login-modal";
import { Button } from "@/components/ui/button";
import {
  nextFavoriteState,
  shouldRedirectToLogin,
  toFavoritesResult,
} from "@/lib/favorites/toggle";

interface FavoriteButtonProps {
  courtId: string;
  /** null = anonimo: il tap apre il login invece di scrivere. */
  currentUserId: string | null;
  /** Riga letta server-side: evita flash al primo paint. */
  initialIsFavorite: boolean;
}

/**
 * Cuore dei preferiti (#22), accanto al titolo della scheda campo.
 *
 * Gate come ReportButton: da anonimo apre il LoginModal esistente, mai un
 * modal nuovo. Toggle ottimistico con rollback + toast.error se la scrittura
 * fallisce (offline, RLS su pending, conflitto).
 */
export function FavoriteButton({
  courtId,
  currentUserId,
  initialIsFavorite,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [pending, setPending] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const handleClick = async () => {
    if (shouldRedirectToLogin(currentUserId)) {
      setLoginOpen(true);
      return;
    }
    const userId = currentUserId as string;
    const next = nextFavoriteState(isFavorite);
    const previous = isFavorite;
    setIsFavorite(next);
    setPending(true);
    try {
      const supabase = createClient();
      const favs = supabase.from("user_favorites");
      const { error } =
        next === true
          ? await favs.insert({ user_id: userId, court_id: courtId })
          : await favs
              .delete()
              .eq("user_id", userId)
              .eq("court_id", courtId);
      const result = toFavoritesResult(error);
      if (!result.ok) throw new Error(result.message);
      toast.success(
        next ? "Campo salvato tra i preferiti." : "Campo rimosso dai preferiti."
      );
    } catch (err) {
      setIsFavorite(previous);
      toast.error("Salvataggio non riuscito. Riprova.");
      console.error("Favorite toggle error:", err);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={isFavorite}
        aria-label={
          isFavorite ? "Rimuovi dai preferiti" : "Salva tra i preferiti"
        }
        // `shrink-0`: il cuore tiene i 48px anche quando il nome del campo è
        // lungo e il blocco testo si comprime (header a 360px).
        className={
          isFavorite
            ? "shrink-0"
            : "shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }
      >
        <Heart
          className="h-6 w-6"
          aria-hidden="true"
          fill={isFavorite ? "currentColor" : "none"}
        />
      </Button>
      {!currentUserId && (
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  );
}
