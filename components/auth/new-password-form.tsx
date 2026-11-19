"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  newPasswordSchema,
  type NewPasswordValues,
} from "@/lib/validation/schemas";
import { mapNewPasswordError } from "@/components/auth/new-password";

/**
 * Form della schermata nuova password (ticket 109, recupero + invito).
 *
 * Montato solo dalla pagina server dopo il gate di sessione: qui dentro
 * `updateUser` ha sempre una sessione. Stesso pattern dei form esistenti
 * (review-form): valori conservati dopo l'errore, primo campo in errore
 * focalizzato, banner `role="alert"`, esito `role="status"`.
 */
export function NewPasswordForm() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const submittingRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetryError, setCanRetryError] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { password: "", confirm: "" },
  });

  const focusFirstError = (fieldErrors: FieldErrors<NewPasswordValues>) => {
    if (fieldErrors.password) {
      setFocus("password");
    } else if (fieldErrors.confirm) {
      setFocus("confirm");
    }
  };

  const onValidSubmit = async (values: NewPasswordValues) => {
    if (submittingRef.current || done) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        const mapped = mapNewPasswordError(updateError);
        setError(mapped.message);
        setCanRetryError(mapped.canRetry);
        return;
      }

      setDone(true);
      // Breve pausa: l'esito `role="status"` deve essere annunciato prima
      // di lasciare la pagina.
      window.setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 900);
    } catch {
      setError("Controlla la connessione e riprova.");
      setCanRetryError(true);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onValidSubmit, focusFirstError)}
      aria-busy={loading || undefined}
      className="space-y-3"
      noValidate
    >
      {error && (
        <div
          role="alert"
          className="rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3"
        >
          <p className="flex items-start gap-1.5 text-sm text-[var(--danger-dark)]">
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {error}
          </p>
          {canRetryError && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              I valori restano qui: riprova.
            </p>
          )}
        </div>
      )}

      {done && (
        <div
          role="status"
          className="rounded-card border border-[var(--success)]/40 bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]"
        >
          Password aggiornata.
        </div>
      )}

      <div>
        <label
          htmlFor="new-password"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
        >
          Nuova password
        </label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            placeholder="Almeno 8 caratteri"
            autoComplete="new-password"
            readOnly={loading || done}
            aria-invalid={errors.password ? "true" : undefined}
            aria-describedby={errors.password ? "new-password-error" : undefined}
            // 56px a destra: il testo non finisce sotto il toggle
            // (stesso pattern del login-modal).
            className="pr-14"
            {...register("password")}
          />
          {/* type="button": il toggle non invia mai il form. Il nome
              accessibile è uno sr-only e non un aria-label (stesso motivo
              del login-modal: i locator e2e per nome accessibile). */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={showPassword}
            aria-controls="new-password"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-1 top-1/2 h-11 w-11 -translate-y-1/2 rounded-control-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--focus-ring)]"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {showPassword ? "Nascondi password" : "Mostra password"}
            </span>
          </Button>
        </div>
        {errors.password && (
          <p
            id="new-password-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="new-password-confirm"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]"
        >
          Ripeti la password
        </label>
        <div className="relative">
          <Input
            id="new-password-confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Ripeti la password"
            autoComplete="new-password"
            readOnly={loading || done}
            aria-invalid={errors.confirm ? "true" : undefined}
            aria-describedby={errors.confirm ? "new-password-confirm-error" : undefined}
            className="pr-14"
            {...register("confirm")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={showConfirm}
            aria-controls="new-password-confirm"
            onClick={() => setShowConfirm((visible) => !visible)}
            className="absolute right-1 top-1/2 h-11 w-11 -translate-y-1/2 rounded-control-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--focus-ring)]"
          >
            {showConfirm ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {showConfirm ? "Nascondi password" : "Mostra password"}
            </span>
          </Button>
        </div>
        {errors.confirm && (
          <p
            id="new-password-confirm-error"
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--danger)]"
          >
            {errors.confirm.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading || done}>
        {loading && (
          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {loading
          ? "Salvataggio…"
          : error && canRetryError
            ? "Riprova"
            : "Salva la password"}
      </Button>
    </form>
  );
}
