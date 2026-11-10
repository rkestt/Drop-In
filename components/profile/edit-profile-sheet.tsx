"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  editProfileSchema,
  type EditProfileValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditProfileSheetProps {
  userId: string;
  currentNickname: string | null;
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
    }
  }, [open, currentNickname, reset]);

  const focusFirstError = (fieldErrors: FieldErrors<EditProfileValues>) => {
    if (fieldErrors.nickname) setFocus("nickname");
  };

  const onValidSave = async (values: EditProfileValues) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nickname: values.nickname || null })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setOpen(false);
      toast.success("Nickname salvato.");
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
