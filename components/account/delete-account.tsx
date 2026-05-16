"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/app/dashboard/account/actions";
import { Trash2, AlertTriangle, X } from "lucide-react";

interface DeleteAccountProps {
  userId: string;
}

const CONFIRM_TEXT = "ELIMINA";

export function DeleteAccount({ userId }: DeleteAccountProps) {
  const [open, setOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmInput === CONFIRM_TEXT;

  const handleDelete = async () => {
    if (!canDelete) return;

    setLoading(true);
    setError(null);

    try {
      await deleteAccount(userId);
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof Error ? err.message : "Errore durante l'eliminazione"
      );
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-4 h-4 text-[var(--danger)]" />
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
          Elimina account
        </label>
      </div>

      {!open ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Elimina account
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20">
            <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--danger)]">
                Attenzione: azione irreversibile
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Tutti i tuoi dati, partite e statistiche verranno eliminati
                permanentemente. Digita{" "}
                <span className="font-bold text-[var(--danger)] tracking-wider">
                  {CONFIRM_TEXT}
                </span>{" "}
                per confermare.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmInput("");
                setError(null);
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`Scrivi ${CONFIRM_TEXT}`}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--cool-muted)]/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--danger)]/30 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={!canDelete || loading}
              onClick={handleDelete}
            >
              {loading ? "Eliminazione..." : "Conferma eliminazione"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
                setConfirmInput("");
                setError(null);
              }}
              disabled={loading}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
