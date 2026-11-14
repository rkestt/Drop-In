"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  pendingSubmissionSchema,
  type PendingSubmissionValues,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/client";
import { SPORTS } from "@/lib/sport/sports";
import {
  isActionableSubmission,
  latestRejectedNote,
  mapMySubmission,
  type MySubmissionItem,
  type MySubmissionRow,
  type SubmissionNoteRow,
} from "@/lib/court/my-submissions";
import { deleteCourtPhoto } from "@/lib/storage/court-photos";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/** Stesse superfici del form di invio (submit-court-form). */
const SURFACE_OPTIONS = [
  { value: "", label: "Non specificata" },
  { value: "asphalt", label: "Asfalto" },
  { value: "concrete", label: "Cemento" },
  { value: "wood", label: "Legno" },
  { value: "grass", label: "Erba" },
  { value: "rubber", label: "Gomma" },
  { value: "tartan", label: "Tartan" },
];

const SELECT_CLASS =
  "flex w-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-control px-4 py-3.5 text-base border border-transparent transition-colors focus:outline-none focus:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 min-h-[48px]";

/**
 * Le proposte pending e rejected dell'utente (#58, esito + resubmit #47).
 * Sezione montata su /submit-court: ogni riga mostra nome, sport, data di
 * invio e badge di stato ("In revisione" / "Rifiutata"). Le pending hanno
 * Modifica (drawer) e Ritira (conferma distruttiva nel drawer); le rejected
 * mostrano il motivo del moderatore e l'azione "Riprova" (resubmit ->
 * torna pending). Senza proposte non rende nulla: niente blocco vuoto.
 */
export function MySubmissions() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<MySubmissionItem[] | null>(null);
  const [editing, setEditing] = useState<MySubmissionItem | null>(null);
  const [confirmingRetract, setConfirmingRetract] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retracting, setRetracting] = useState(false);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const retractingRef = useRef(false);
  // Conferma di ritiro: il pannello prende il focus quando compare (il
  // bottone che l'ha aperto viene smontato) e lo restituisce a "Indietro"
  // quando si torna sui propri passi.
  const confirmPanelRef = useRef<HTMLDivElement | null>(null);
  const retractTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreRetractFocus = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<PendingSubmissionValues>({
    resolver: zodResolver(pendingSubmissionSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "", sport: "", surface: "", hasPhoto: false },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setUserId(null);
        setItems([]);
        return;
      }
      setUserId(data.user.id);
      // Pending + rejected (le rejected mostrano nota e "Riprova"): la nota
      // vive in `court_submissions`, non in `courts` — la si unisce qui per
      // court_id (la RLS lascia vedere al proponente solo le proprie righe).
      const [{ data: rows, error }, { data: notes }] = await Promise.all([
        supabase
          .from("courts")
          .select("id,name,sport,surface_type,photo_path,created_at,moderation_status")
          .eq("submitted_by", data.user.id)
          .in("moderation_status", ["pending", "rejected"])
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("court_submissions")
          .select("court_id,moderation_note,status,created_at")
          .eq("submitter_id", data.user.id),
      ]);
      if (cancelled) return;
      if (error) {
        setItems([]);
        return;
      }
      setItems(
        ((rows ?? []) as MySubmissionRow[])
          .map((row) =>
            mapMySubmission({
              ...row,
              moderation_note: latestRejectedNote(
                (notes ?? []) as SubmissionNoteRow[],
                row.id
              ),
            })
          )
          .filter((item): item is MySubmissionItem => item !== null)
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A ogni apertura si riparte dai valori della riga; la conferma di ritiro
  // e gli errori non sopravvivono alla chiusura.
  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        sport: SPORTS.some((s) => s.value === editing.sport)
          ? (editing.sport ?? "")
          : "",
        surface: editing.surface ?? "",
        hasPhoto: editing.photoPath != null,
      });
      setConfirmingRetract(false);
      // Apertura pulita: nessun focus da restituire al trigger.
      restoreRetractFocus.current = false;
      setEditError(null);
    }
  }, [editing, reset]);

  // Focus sulla conferma di ritiro: senza questo, il tap su "Ritira
  // proposta" smonta il bottone e il focus cade sul body (tastiera persa).
  useEffect(() => {
    if (confirmingRetract) {
      confirmPanelRef.current?.focus();
      restoreRetractFocus.current = true;
      return;
    }
    if (restoreRetractFocus.current) {
      restoreRetractFocus.current = false;
      retractTriggerRef.current?.focus();
    }
  }, [confirmingRetract]);

  const focusFirstError = (fieldErrors: FieldErrors<PendingSubmissionValues>) => {
    const order: (keyof PendingSubmissionValues)[] = ["name", "sport", "surface"];
    for (const field of order) {
      if (fieldErrors[field]) {
        setFocus(field);
        return;
      }
    }
  };

  /** Rilegge la riga dopo update/resubmit: vale il DB, non la replica locale.
   * Rilegge anche la nota (dopo il resubmit la rejected sparisce dalla
   * lista delle note); una riga uscita da pending/rejected esce dalla lista.
   */
  const refreshItem = async (id: string) => {
    if (!userId) return;
    const [{ data }, { data: notes }] = await Promise.all([
      supabase
        .from("courts")
        .select("id,name,sport,surface_type,photo_path,created_at,moderation_status")
        .eq("id", id)
        .single(),
      supabase
        .from("court_submissions")
        .select("court_id,moderation_note,status,created_at")
        .eq("submitter_id", userId)
        .eq("court_id", id)
        .eq("status", "rejected")
        .not("moderation_note", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (data) {
      const fresh = mapMySubmission({
        ...(data as MySubmissionRow),
        moderation_note:
          (notes as SubmissionNoteRow[] | null)?.[0]?.moderation_note ?? null,
      });
      setItems(
        (prev) =>
          prev?.flatMap((it) =>
            it.id === id ? (fresh ? [fresh] : []) : [it]
          ) ?? prev
      );
    }
  };

  const onValidSave = async (values: PendingSubmissionValues) => {
    if (!editing || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setEditError(null);
    try {
      const { error: rpcError } = await supabase.rpc("update_pending_submission", {
        p_court_id: editing.id,
        p_name: values.name,
        // `undefined` = parametro omesso: PostgREST applica il DEFAULT NULL
        // della funzione (i tipi generati non ammettono `null` esplicito).
        p_sport: values.sport === "" ? undefined : values.sport,
        p_surface: values.surface === "" ? undefined : values.surface,
      });
      if (rpcError) throw rpcError;
      await refreshItem(editing.id);
      setEditing(null);
      toast.success("Proposta aggiornata.");
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Errore durante il salvataggio."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onConfirmRetract = async () => {
    if (!editing || retractingRef.current) return;
    retractingRef.current = true;
    setRetracting(true);
    setEditError(null);
    try {
      const { error: rpcError } = await supabase.rpc("retract_submission", {
        p_court_id: editing.id,
      });
      if (rpcError) throw rpcError;
      if (editing.photoPath) {
        await deleteCourtPhoto(supabase, editing.photoPath);
      }
      setItems((prev) => prev?.filter((it) => it.id !== editing.id) ?? prev);
      setEditing(null);
      toast.success("Proposta ritirata.");
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Errore durante il ritiro."
      );
    } finally {
      retractingRef.current = false;
      setRetracting(false);
    }
  };

  /** Ripropone una rejected: torna pending, la storia resta. */
  const onResubmit = async (item: MySubmissionItem) => {
    if (resubmittingId != null) return;
    setResubmittingId(item.id);
    try {
      const { error: rpcError } = await supabase.rpc("resubmit_submission", {
        p_court_id: item.id,
      });
      if (rpcError) throw rpcError;
      await refreshItem(item.id);
      toast.success("Proposta riproposta: torna in revisione.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Non è stato possibile riproporre."
      );
    } finally {
      setResubmittingId(null);
    }
  };

  if (!userId || !items || items.length === 0) return null;

  const sportOptions =
    editing?.sport &&
    editing.sport !== "" &&
    !SPORTS.some((s) => s.value === editing.sport)
      ? [...SPORTS, { value: editing.sport, label: editing.sport }]
      : SPORTS;

  return (
    <section
      aria-labelledby="my-submissions-title"
      className="mt-10 border-t border-[var(--cool-muted)]/20 pt-6"
    >
      <h2
        id="my-submissions-title"
        className="text-lg font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)] mb-1"
      >
        Le tue proposte
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        In revisione prima di apparire sulla mappa. Quelle rifiutate mostrano
        il motivo e si possono riproporre.
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          // Metadati in una sola stringa: il punto resta attaccato alla voce
          // precedente (NBSP) quando il testo va a capo a 360px.
          const meta = [item.sportLabel, item.submittedLabel]
            .filter(Boolean)
            .join("\u00A0· ");
          return (
            <li
              key={item.id}
              className="bg-[var(--bg-surface)] rounded-card p-4"
            >
              {/* Due righe: nome + stato, poi metadati + azione. Su 360px il
                  badge accanto al nome lasciava al nome ~90px (troncato a
                  "Campetto V…"). */}
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 line-clamp-2 font-medium text-[var(--text-primary)]">
                  {item.name}
                </p>
                <Badge
                  variant={item.pending ? "accent" : "danger"}
                  className="shrink-0"
                >
                  {item.statusLabel}
                </Badge>
              </div>
              {/* Motivo del rifiuto: testo visibile, non solo tooltip. */}
              {item.status === "rejected" && item.moderationNote && (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Motivo:{" "}
                  </span>
                  {item.moderationNote}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                  {meta}
                </p>
                {isActionableSubmission(item.status) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditing(item)}
                  >
                    Modifica
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    disabled={resubmittingId === item.id}
                    onClick={() => onResubmit(item)}
                  >
                    {resubmittingId === item.id ? "Ripropongo…" : "Riprova"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* La conferma di ritiro è uno step a sé: il drawer cambia titolo e
          nasconde i campi, così non resta il dubbio "sto salvando o
          ritirando?" e il pannello non cresce oltre lo schermo. */}
      <Drawer
        open={editing != null}
        onClose={() => setEditing(null)}
        title={confirmingRetract ? "Ritira proposta" : "Modifica proposta"}
        description={
          confirmingRetract
            ? undefined
            : "Solo nome, sport e superficie. La posizione resta quella inviata."
        }
      >
        {editing && !confirmingRetract && (
          <form
            onSubmit={handleSubmit(onValidSave, focusFirstError)}
            className="flex flex-col gap-4"
            noValidate
          >
            {editError && (
              <div
                className="p-3 rounded-card bg-[var(--danger)]/10 text-[var(--danger-dark)] text-sm"
                role="alert"
              >
                {editError}
              </div>
            )}

            <div>
              <label
                htmlFor="pending-submission-name"
                className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
              >
                Nome del campo
              </label>
              <Input
                id="pending-submission-name"
                {...register("name")}
                placeholder="Es. Campetto Via Napoli"
                aria-invalid={errors.name ? "true" : undefined}
                aria-describedby={
                  errors.name
                    ? "pending-submission-name-error"
                    : undefined
                }
              />
              {errors.name && (
                <p
                  id="pending-submission-name-error"
                  role="alert"
                  className="mt-1.5 text-sm text-[var(--danger)]"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pending-submission-sport"
                className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
              >
                Sport
              </label>
              <select
                id="pending-submission-sport"
                {...register("sport")}
                aria-invalid={errors.sport ? "true" : undefined}
                className={SELECT_CLASS}
              >
                <option value="">Non specificato</option>
                {sportOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.sport && (
                <p role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                  {errors.sport.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pending-submission-surface"
                className="text-sm font-semibold text-[var(--text-primary)] block mb-1.5"
              >
                Superficie
              </label>
              <select
                id="pending-submission-surface"
                {...register("surface")}
                aria-invalid={errors.surface ? "true" : undefined}
                className={SELECT_CLASS}
              >
                {SURFACE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                {editing.surface &&
                  editing.surface !== "" &&
                  !SURFACE_OPTIONS.some((o) => o.value === editing.surface) && (
                    <option value={editing.surface}>{editing.surface}</option>
                  )}
              </select>
              {errors.surface && (
                <p role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
                  {errors.surface.message}
                </p>
              )}
            </div>

            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
                className="flex-1 min-h-[48px]"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                className="flex-1 min-h-[48px]"
              >
                {saving ? "Salvataggio…" : "Salva modifiche"}
              </Button>
            </div>

            {/* Zona distruttiva: divisa dalla CTA di salvataggio, così
                "Salva modifiche" e "Ritira" non sono due bottoni vicini. */}
            <div className="mt-2 border-t border-[var(--cool-muted)]/20 pt-4">
              <Button
                ref={retractTriggerRef}
                type="button"
                variant="ghost"
                onClick={() => setConfirmingRetract(true)}
                className="w-full min-h-[44px] justify-start gap-2 px-0 text-[var(--danger)] hover:bg-[var(--danger)]/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Ritira proposta
              </Button>
              <p className="text-xs text-[var(--text-muted)]">
                Elimina la proposta e la foto.
              </p>
            </div>
          </form>
        )}

        {editing && confirmingRetract && (
          <div
            ref={confirmPanelRef}
            tabIndex={-1}
            role="group"
            aria-label="Conferma ritiro proposta"
            className="rounded-card border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
          >
            <p className="text-sm text-[var(--text-primary)]">
              Viene eliminata insieme alla foto. L&apos;operazione non si può
              annullare.
            </p>
            <div className="mt-3 flex gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmingRetract(false)}
                className="flex-1 min-h-[44px]"
              >
                Indietro
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={retracting}
                onClick={onConfirmRetract}
                className="flex-1 min-h-[44px]"
              >
                {retracting ? "Ritiro…" : "Conferma ritiro"}
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </section>
  );
}
