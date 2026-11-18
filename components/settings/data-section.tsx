"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const EXPORT_HREF = "/api/account/export";
const DELETE_HREF = "/api/account/delete";

/**
 * "I tuoi dati" (#94): scarica l'export personale (`GET
 * /api/account/export`, un download) ed elimina l'account.
 *
 * La cancellazione è irreversibile e passa da due passi: la riga apre il
 * drawer di conferma (testo vero su cosa sparisce), il bottone danger dentro
 * il drawer esegue. Stesso schema della conferma di uscita in
 * `account-section.tsx`, non un secondo pattern.
 *
 * Il blocco "lobby future con altri iscritti" lo decide il server (409): qui
 * si mostra il suo messaggio, senza reinventare la regola.
 */
export function DataSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const openConfirm = () => {
    setError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
    setError(null);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(DELETE_HREF, { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        // 409 = lobby future con altri iscritti. Il testo è del server:
        // spiega da solo cosa fare, qui non se ne inventa un altro.
        setError(
          typeof body?.error === "string" && body.error.trim() !== ""
            ? body.error
            : "Non siamo riusciti a cancellare l'account. Riprova."
        );
        return;
      }

      // Account sparito: la sessione non vale più. `scope: "local"` pulisce
      // i cookie senza chiamare il server (l'utente non esiste più).
      try {
        const supabase = createClient();
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Sessione già invalida: il redirect da anonimo funziona lo stesso.
      }
      toast.success("Account eliminato.");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Connessione assente: controlla la rete e riprova.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-labelledby="settings-data">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
        <h2
          id="settings-data"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
          I tuoi dati
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="mt-2 overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        {/* Download vero, non una pagina: `<a>` al route handler che risponde
            con Content-Disposition attachment. */}
        <a
          href={EXPORT_HREF}
          download
          className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--text-primary)]">
              Scarica i miei dati
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Profilo, lobby, iscrizioni, check-in e recensioni in un file JSON.
            </span>
          </span>
          <Download
            className="w-5 h-5 flex-none text-[var(--accent)]"
            aria-hidden="true"
          />
        </a>

        <div aria-hidden="true" className="mx-4 h-px bg-[var(--border)]" />

        <button
          type="button"
          onClick={openConfirm}
          aria-haspopup="dialog"
          className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-semibold text-[var(--danger)]">
              Elimina account
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Cancella profilo, iscrizioni, check-in e avatar. Non si torna
              indietro.
            </span>
          </span>
          <Trash2
            className="w-5 h-5 flex-none text-[var(--danger)]"
            aria-hidden="true"
          />
        </button>
      </div>

      <Drawer
        open={confirmOpen}
        onClose={closeConfirm}
        title="Eliminare l'account?"
        description="Il tuo profilo, le iscrizioni alle lobby, i check-in e l'avatar vengono cancellati per sempre. Non si può tornare indietro."
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Non puoi eliminare l&apos;account se hai lobby future con altri
          iscritti.
        </p>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-control-sm bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger-dark)]"
          >
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            variant="danger"
            onClick={deleteAccount}
            disabled={deleting}
            className="min-h-11 w-full"
          >
            {deleting ? "Eliminazione…" : "Elimina account"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={closeConfirm}
            disabled={deleting}
            className="min-h-11 w-full"
          >
            Annulla
          </Button>
        </div>
      </Drawer>
    </section>
  );
}
