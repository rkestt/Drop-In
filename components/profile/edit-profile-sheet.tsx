"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, User } from "lucide-react";
import {
  editProfileSchema,
  type EditProfileValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import {
  avatarPublicUrl,
  deleteAvatar,
  uploadAvatar,
} from "@/lib/storage/avatars";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

interface EditProfileSheetProps {
  userId: string;
  currentNickname: string | null;
  currentAvatarUrl?: string | null;
  /** "create" = stato senza nickname: CTA "Imposta nickname". */
  mode: "edit" | "create";
  /**
   * Trigger custom (es. link testuale in Impostazioni). Se assente si usa la
   * CTA primaria della pagina Profilo.
   */
  children?: React.ReactNode;
}

/**
 * Drawer di modifica nickname (unica CTA primaria della pagina Profilo).
 *
 * Validazione: `editProfileSchema` (unica fonte, niente regole duplicate).
 * Nota: lo schema ammette stringa vuota (azzera il nickname), quindi il caso
 * "vuoto" del prototipo salva `null`; l'errore inline scatta oltre i 30
 * caratteri e sugli errori di rete/DB.
 */
export function EditProfileSheet({
  userId,
  currentNickname,
  currentAvatarUrl,
  mode,
  children,
}: EditProfileSheetProps) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { nickname: currentNickname ?? "" },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Avatar: `pendingFile` in attesa di upload al salvataggio, `removeAvatar`
  // per azzerare, `avatarPreview` object URL della scelta corrente.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);
  // Focus iniziale del Drawer (Base UI lo applica all'apertura, dopo il trap).
  const nicknameRef = useRef<HTMLInputElement | null>(null);
  // Funzione, non ref diretto: Base UI legge `ref.current` troppo presto
  // (popup appena montato, ref del campo ancora null) e il focus resta su
  // body col trap disinserito. La funzione viene valutata all'apertura,
  // a ref attaccato.
  const focusNickname = useCallback(
    () => nicknameRef.current,
    []
  );
  const supabase = createClient();
  const router = useRouter();

  // A ogni apertura si riparte dal nickname corrente (dati conservati su
  // errore solo dentro la stessa apertura).
  useEffect(() => {
    if (open) {
      reset({ nickname: currentNickname ?? "" });
      setError(null);
      setPendingFile(null);
      setRemoveAvatar(false);
      setAvatarError(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setAvatarPreview(null);
    }
  }, [open, currentNickname, reset]);

  // Revoca l'object URL quando il drawer si smonta.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const onAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Formato non supportato: scegli una foto.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("La foto supera i 5 MB.");
      return;
    }
    setAvatarError(null);
    setRemoveAvatar(false);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarPreview(url);
    setPendingFile(file);
  };

  const onRemoveAvatar = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAvatarPreview(null);
    setPendingFile(null);
    setAvatarError(null);
    setRemoveAvatar(true);
  };

  const focusFirstError = (fieldErrors: FieldErrors<EditProfileValues>) => {
    if (fieldErrors.nickname) setFocus("nickname");
  };

  const onValidSave = async (values: EditProfileValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Avatar prima del write sul profilo: il bare path (`<uid>/<uuid>.jpg`)
      // finisce in `avatar_url` nella stessa update del nickname (forma
      // canonica dal 028; i lettori accettano anche gli URL assoluti storici).
      let avatarUrl: string | null | undefined;
      if (removeAvatar) {
        avatarUrl = null;
      } else if (pendingFile) {
        try {
          const uploaded = await uploadAvatar(supabase, pendingFile);
          avatarUrl = uploaded.path;
        } catch (err) {
          setAvatarError(
            err instanceof Error ? err.message : "Upload della foto fallito."
          );
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(
          avatarUrl === undefined
            ? { nickname: values.nickname || null }
            : { nickname: values.nickname || null, avatar_url: avatarUrl }
        )
        .eq("user_id", userId);

      if (updateError) throw updateError;

      // Il vecchio oggetto non serve più: cancellazione best-effort, il GC
      // mensile (`npm run photos:gc`) copre comunque i casi persi.
      if (
        avatarUrl !== undefined &&
        currentAvatarUrl &&
        currentAvatarUrl !== avatarUrl
      ) {
        void deleteAvatar(supabase, currentAvatarUrl);
      }

      setOpen(false);
      toast.success("Profilo salvato.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore durante il salvataggio."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const nicknameError = errors.nickname?.message;
  const shownAvatar =
    avatarPreview ?? (removeAvatar ? null : avatarPublicUrl(currentAvatarUrl));
  // Ref del campo fuso con RHF: serve a `initialFocus` del Drawer.
  const { ref: nicknameRhfRef, ...nicknameRegister } = register("nickname");

  return (
    <>
      {children ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {children}
        </button>
      ) : (
        <Button
          type="button"
          variant="primary"
          onClick={() => setOpen(true)}
          className={cn("w-full min-h-[48px]", mode === "edit" && "gap-2")}
        >
          {mode === "edit" && <Pencil className="w-4 h-4" aria-hidden="true" />}
          {mode === "edit" ? "Modifica" : "Imposta nickname"}
        </Button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Modifica nickname"
        initialFocus={focusNickname}
      >
        <form
          onSubmit={handleSubmit(onValidSave, focusFirstError)}
          className="flex flex-col gap-4"
          noValidate
        >
          {error && (
            <div
              className="p-3 rounded-card bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">
              Foto profilo
            </span>
            <div className="flex items-center gap-3">
              {shownAvatar ? (
                <img
                  src={shownAvatar}
                  alt=""
                  width={72}
                  height={72}
                  className="w-[72px] h-[72px] rounded-chip border border-[var(--border-strong)] object-cover shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center w-[72px] h-[72px] rounded-chip border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shrink-0"
                >
                  <User className="w-7 h-7" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {/* Input file nativo, vestito con i token: il bottone di
                    sistema resta quello del browser (niente click
                    programmatici), ma smette di essere un rettangolo grigio
                    dentro un campo scuro. */}
                <input
                  id="profile-avatar"
                  type="file"
                  accept="image/*"
                  onChange={onAvatarSelect}
                  aria-label="Foto profilo"
                  aria-invalid={avatarError ? "true" : undefined}
                  aria-describedby={
                    avatarError
                      ? "profile-avatar-error profile-avatar-hint"
                      : "profile-avatar-hint"
                  }
                  className="block w-full min-h-[44px] cursor-pointer rounded-control text-sm text-[var(--text-secondary)] file:me-3 file:cursor-pointer file:rounded-control-sm file:border file:border-[var(--border-strong)] file:bg-[var(--bg-surface)] file:px-3 file:py-3 file:text-sm file:font-semibold file:text-[var(--text-primary)] hover:file:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                />
                {(pendingFile || (!removeAvatar && currentAvatarUrl)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onRemoveAvatar}
                    className="mt-1 px-0 min-h-[44px] text-[var(--text-secondary)] hover:bg-transparent hover:text-[var(--text-primary)]"
                  >
                    Rimuovi foto
                  </Button>
                )}
              </div>
            </div>
            {avatarError && (
              <p
                id="profile-avatar-error"
                role="alert"
                className="mt-1.5 text-sm text-[var(--danger)]"
              >
                {avatarError}
              </p>
            )}
            <p
              id="profile-avatar-hint"
              className="mt-1.5 text-[13px] text-[var(--text-muted)]"
            >
              Quadrata, max 5 MB. La vedono gli altri giocatori.
            </p>
          </div>

          <div>
            <label
              htmlFor="profile-nickname"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Nickname
            </label>
            <Input
              id="profile-nickname"
              {...nicknameRegister}
              type="text"
              placeholder="Il tuo nickname"
              autoComplete="nickname"
              aria-invalid={nicknameError ? "true" : undefined}
              aria-describedby={
                nicknameError
                  ? "profile-nickname-error profile-nickname-hint"
                  : "profile-nickname-hint"
              }
              className={cn(nicknameError && "border-[var(--danger)]")}
              ref={(el) => {
                nicknameRhfRef(el);
                nicknameRef.current = el;
              }}
            />
            {nicknameError && (
              <p
                id="profile-nickname-error"
                role="alert"
                className="mt-1.5 text-sm text-[var(--danger)]"
              >
                {nicknameError}
              </p>
            )}
            <p
              id="profile-nickname-hint"
              className="mt-1.5 text-[13px] text-[var(--text-muted)]"
            >
              Massimo 30 caratteri. Lo vedono gli altri giocatori.
            </p>
          </div>

          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1 min-h-[48px]"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-1 min-h-[48px]"
            >
              {loading ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
