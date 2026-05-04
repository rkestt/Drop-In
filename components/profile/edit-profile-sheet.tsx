"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";

interface EditProfileSheetProps {
  children: React.ReactNode;
  currentNickname: string | null;
  userId: string;
}

export function EditProfileSheet({
  children,
  currentNickname,
  userId,
}: EditProfileSheetProps) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(currentNickname || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname: nickname.trim() || null })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-transparent border-0 p-0 cursor-pointer"
      >
        {children}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Modifica profilo">
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm">
              Profilo aggiornato!
            </div>
          )}

          <div>
            <label
              htmlFor="profile-nickname"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Nickname
            </label>
            <Input
              id="profile-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Il tuo nickname"
              maxLength={30}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
