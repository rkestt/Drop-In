"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Camera } from "lucide-react";

interface EditProfileSheetProps {
  children: React.ReactNode;
  currentNickname: string | null;
  currentAvatar: string | null;
  userId: string;
  onAvatarUpdate?: (url: string) => void;
}

export function EditProfileSheet({
  children,
  currentNickname,
  currentAvatar,
  userId,
  onAvatarUpdate,
}: EditProfileSheetProps) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(currentNickname || "");
  const [avatar, setAvatar] = useState(currentAvatar || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Formato non supportato. Usa JPG, PNG, WEBP o GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Immagine troppo grande. Max 5MB.");
      return;
    }

    setAvatarFile(file);
    setAvatar(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Upload avatar if changed
      if (avatarFile) {
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append("file", avatarFile);

        const res = await fetch("/api/profile/avatar", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Errore upload avatar");

        setAvatar(data.url);
        onAvatarUpdate?.(data.url);
        setUploadingAvatar(false);
      }

      // Update nickname
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
      setUploadingAvatar(false);
    }
  };

  const isBusy = loading || uploadingAvatar;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        className="bg-transparent border-0 p-0 cursor-pointer"
      >
        {children}
      </div>
      <BottomSheet open={open} onClose={() => !isBusy && setOpen(false)} title="Modifica profilo">
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm animate-scale-in" role="alert" aria-live="assertive">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm animate-scale-in" role="status" aria-live="polite">
              Profilo aggiornato!
            </div>
          )}

          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden bg-[var(--bg-surface)] border-2 border-[var(--border)] flex items-center justify-center"
                style={{ background: avatar ? `url(${avatar}) center/cover no-repeat` : undefined }}
              >
                {!avatar && (
                  <span className="text-3xl font-bold text-[var(--text-muted)] font-[family-name:var(--font-syne)]">
                    {(nickname || currentNickname || "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50"
                aria-label="Cambia avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-[var(--text-muted)]">JPG, PNG, WEBP o GIF — max 5MB</p>
          </div>

          {/* Nickname */}
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
              disabled={isBusy}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isBusy}>
            {uploadingAvatar ? "Caricamento avatar..." : loading ? "Salvataggio..." : "Salva"}
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
