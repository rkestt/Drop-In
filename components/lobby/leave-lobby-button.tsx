"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LeaveLobbyButtonProps {
  lobbyId: string;
  userId: string;
}

export function LeaveLobbyButton({ lobbyId, userId }: LeaveLobbyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLeave = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("lobby_participants")
        .delete()
        .eq("lobby_id", lobbyId)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'uscita.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <p className="text-sm text-[var(--danger)] mb-2">{error}</p>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleLeave}
        disabled={loading}
      >
        <LogOut className="w-4 h-4 mr-1.5" />
        {loading ? "Uscita..." : "Lascio il campo"}
      </Button>
    </>
  );
}
