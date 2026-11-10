"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EditProfileSheet } from "@/components/profile/edit-profile-sheet";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface AccountSectionProps {
  email: string;
  userId: string;
  nickname: string | null;
}

/**
 * "Account" section: read-only email, nickname editing through the profile
 * drawer (d11), and logout behind a confirmation drawer ("Vuoi uscire?").
 * Sign-out failures stay inline with a retry — no isolated toast recovery.
 */
export function AccountSection({ email, userId, nickname }: AccountSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setConfirmOpen(false);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Uscita non riuscita."
      );
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <section aria-labelledby="settings-account">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h2
          id="settings-account"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          Account
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-primary)]">
              Email
            </span>
            <span className="break-words text-sm text-[var(--text-secondary)]">
              {email}
            </span>
          </span>
          <span className="flex-none text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Sola lettura
          </span>
        </div>

        <div
          aria-hidden="true"
          className="mx-4 h-px bg-[var(--border)]"
        />

        <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-primary)]">
              Nickname
            </span>
            <span className="break-all text-sm text-[var(--text-secondary)]">
              {nickname || "Non impostato"}
            </span>
          </span>
          <EditProfileSheet userId={userId} currentNickname={nickname} mode={nickname ? "edit" : "create"}>
            <span className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-[var(--text-primary)] underline decoration-[var(--text-secondary)] decoration-1 underline-offset-4 hover:decoration-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              Modifica<span className="sr-only"> il nickname</span>
            </span>
          </EditProfileSheet>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        aria-haspopup="dialog"
        className="mt-3 w-full text-[var(--danger)]"
      >
        <LogOut className="w-5 h-5" aria-hidden="true" />
        Esci
      </Button>

      <Drawer
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Vuoi uscire?"
        description="Le tue lobby e il tuo karma restano salvati. Per ritrovarli, accedi di nuovo."
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-control-sm bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]"
          >
            {error}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="danger"
            onClick={signOut}
            disabled={signingOut}
            className="w-full"
          >
            {signingOut ? "Uscita…" : error ? "Riprova" : "Esci"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
            disabled={signingOut}
            className="w-full"
          >
            Annulla
          </Button>
        </div>
      </Drawer>
    </section>
  );
}
