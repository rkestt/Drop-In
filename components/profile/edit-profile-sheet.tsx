"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  editProfileSchema,
  type EditProfileValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
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
  // Nickname in react-hook-form (schema zod = unica fonte).
  // Restano useState solo per: apertura, loading, errori di rete/DB, successo.
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
  const [success, setSuccess] = useState(false);
  // Guardia anti-doppio-invio (il disabled non copre due submit ravvicinati).
  const submittingRef = useRef(false);
  const supabase = createClient();

  // A ogni apertura si riparte dal nickname corrente (dati conservati su
  // errore solo dentro la stessa apertura).
  useEffect(() => {
    if (open) {
      reset({ nickname: currentNickname ?? "" });
      setError(null);
      setSuccess(false);
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

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      submittingRef.current = false;
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
      <Drawer open={open} onClose={() => setOpen(false)} title="Modifica profilo">
        <form onSubmit={handleSubmit(onValidSave, focusFirstError)} className="space-y-4" noValidate>
          {error && (
            <div
              className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm"
              role="alert"
              aria-live="assertive"
            >
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
              {...register("nickname")}
              placeholder="Il tuo nickname"
              autoComplete="nickname"
              aria-invalid={errors.nickname ? "true" : undefined}
              aria-describedby={errors.nickname ? "profile-nickname-error" : undefined}
            />
            {errors.nickname && (
              <p id="profile-nickname-error" role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                {errors.nickname.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </form>
      </Drawer>
    </>
  );
}
