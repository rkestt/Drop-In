"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const REPORT_CATEGORIES = [
  { value: "broken_hoop", label: "Canestro rotto" },
  { value: "wet_court", label: "Campo bagnato" },
  { value: "lighting", label: "Illuminazione" },
  { value: "occupied", label: "Occupato" },
  { value: "other", label: "Altro" },
];

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
}

export function ReportSheet({ open, onClose, courtId, courtName }: ReportSheetProps) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Devi effettuare l'accesso per inviare una segnalazione.");
      }

      if (!category) {
        throw new Error("Seleziona una categoria.");
      }

      const { error: insertError } = await supabase.from("court_reports").insert({
        court_id: courtId,
        user_id: user.id,
        category,
        description: description || null,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCategory("");
        setDescription("");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Segnala stato campo">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {courtName}
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-sm animate-scale-in" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm animate-scale-in" role="status" aria-live="polite">
            Segnalazione inviata!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2">
              Categoria
            </label>
            <div className="flex flex-wrap gap-2">
              {REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${
                    category === cat.value
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="report-description"
              className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5"
            >
              Descrizione (opzionale)
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-[10px] px-4 py-3.5 text-base border border-transparent transition-colors placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[100px] resize-none"
              placeholder="Aggiungi dettagli..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || success}>
            {loading ? "Invio..." : "Invia segnalazione"}
          </Button>
        </form>
      </div>
    </BottomSheet>
  );
}
