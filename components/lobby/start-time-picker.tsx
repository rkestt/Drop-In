"use client";

import * as React from "react";
import { appDateKey, formatAppTime } from "@/lib/datetime";
import {
  firstSelectableSlot,
  lobbyDayOptions,
  lobbyTimeSlots,
  type LobbyDayOption,
} from "@/lib/lobby/slots";
import { cn } from "@/lib/utils";

/**
 * Picker data+ora di "Orario inizio" (#81), al posto di
 * `input type="datetime-local"` che su iOS apre il picker nativo scomodo
 * (ruota orizzontale, testo tagliato a 360px).
 *
 * Controllato: `value` è l'ISO dell'istante scelto (o `null`), `onChange`
 * riceve l'ISO da mettere nel form. La griglia dei giorni scorre in
 * orizzontale (7 giorni, ~3 visibili: il quarto chip tagliato è l'indizio
 * che si scorre), gli slot sono una griglia 4 colonne da 44px, con scroll
 * verticale interno limitato. Tutto il calcolo vive in `lib/lobby/slots.ts`.
 */

export interface StartTimePickerProps {
  /** Istante scelto, ISO. `null`/"" = nessuna scelta. */
  value: string | null;
  onChange: (iso: string) => void;
  /** Etichetta visibile del gruppo. */
  label?: string;
  /** Messaggio di errore: mostrato sotto e collegato via aria-describedby. */
  error?: string;
  /** Forza lo stato di errore anche quando il messaggio non c'è ancora. */
  invalid?: boolean;
  disabled?: boolean;
  /** Ref al primo controllo (react-hook-form la usa per `setFocus`). */
  focusRef?: React.Ref<HTMLButtonElement>;
}

const CONTROL_CLASS =
  "min-h-[44px] transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed";

const DAY_CLASS = cn(
  "shrink-0 snap-start rounded-control-sm border px-3 text-sm font-medium",
  CONTROL_CLASS,
);

const SLOT_CLASS = cn(
  "rounded-control-sm border text-sm font-medium",
  CONTROL_CLASS,
);

function dayIndexForValue(
  value: string | null,
  days: readonly LobbyDayOption[],
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const key = appDateKey(parsed);
  return days.some((day) => day.key === key) ? key : null;
}

export function StartTimePicker({
  value,
  onChange,
  label = "Orario inizio",
  error,
  invalid,
  disabled,
  focusRef,
}: StartTimePickerProps) {
  const autoId = React.useId();
  const labelId = `${autoId}-label`;
  const errorId = `${autoId}-error`;

  // "Adesso" fissato al mount: il drawer smonta i figli alla chiusura
  // (Base UI Portal), quindi alla riapertura il picker riparte fresco.
  const [now] = React.useState(() => new Date());
  const days = React.useMemo(() => lobbyDayOptions(now), [now]);

  // Giorni con almeno uno slot selezionabile: un giorno "chiuso" (es. oggi
  // alle 23:50, quando tutti gli slot sono passati) non deve essere
  // cliccabile solo per mostrare "Nessun orario disponibile".
  const dayHasSlots = React.useMemo(() => {
    const map = new Map<string, boolean>();
    for (const day of days) {
      map.set(day.key, firstSelectableSlot(lobbyTimeSlots(day.key, now)) !== undefined);
    }
    return map;
  }, [days, now]);

  const [dayKey, setDayKey] = React.useState(() => {
    const fromValue = dayIndexForValue(value, days);
    // Il giorno del valore vale solo se ha ancora slot utili: altrimenti il
    // default cadrebbe su un giorno disabilitato.
    if (fromValue && firstSelectableSlot(lobbyTimeSlots(fromValue, now))) {
      return fromValue;
    }
    // A mezzanotte passata "oggi" non ha slot: apri sul primo giorno utile.
    const firstOpenDay = days.find((day) =>
      firstSelectableSlot(lobbyTimeSlots(day.key, now)),
    );
    return firstOpenDay?.key ?? days[0]?.key ?? "";
  });

  const slots = React.useMemo(
    () => (dayKey ? lobbyTimeSlots(dayKey, now) : []),
    [dayKey, now],
  );

  const selectedMs = value ? new Date(value).getTime() : Number.NaN;
  const firstEnabledIndex = slots.findIndex((slot) => !slot.disabled);
  // Tieni UN solo slot passato come confine visivo: un muro di celle spente
  // sopra il primo orario utile è solo da scrollare.
  const visibleSlots = React.useMemo(
    () => (firstEnabledIndex > 1 ? slots.slice(firstEnabledIndex - 1) : slots),
    [slots, firstEnabledIndex],
  );

  // Un valore rimasto da un'apertura precedente e ormai passato non deve
  // restare invisibile nel form: il picker lo azzera appena monta. Stesso
  // discorso se il valore cade in un giorno fuori dai 7 mostrati (ISO valido
  // e futuro ma non rappresentabile nella UI): senza, il picker si aprirebbe
  // su un altro giorno e il submit invierebbe un ISO che l'utente non vede.
  React.useEffect(() => {
    if (!value) return;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms) || ms <= now.getTime()) {
      onChange("");
      return;
    }
    if (!days.some((day) => day.key === appDateKey(new Date(ms)))) {
      onChange("");
    }
  }, [value, now, days, onChange]);

  const handleDaySelect = (day: LobbyDayOption) => {
    if (day.key === dayKey) return;
    setDayKey(day.key);
    // Con un orario già scelto, tienilo se esiste anche nel nuovo giorno;
    // altrimenti passa al primo utile (o azzera se il giorno è chiuso).
    if (!value) return;
    const nextSlots = lobbyTimeSlots(day.key, now);
    const sameTime = nextSlots.find(
      (slot) => slot.time === formatAppTime(value) && !slot.disabled,
    );
    const next = sameTime ?? firstSelectableSlot(nextSlots);
    onChange(next ? next.iso : "");
  };

  const selectedDayIndex = days.findIndex((day) => day.key === dayKey);
  // Il focus (ref di react-hook-form) non deve mai finire su un bottone
  // disabilitato: punta al primo giorno con slot utili.
  const firstOpenDayIndex = days.findIndex((day) => dayHasSlots.get(day.key));
  const focusDayIndex =
    selectedDayIndex >= 0 && dayHasSlots.get(days[selectedDayIndex]?.key ?? "")
      ? selectedDayIndex
      : firstOpenDayIndex >= 0
        ? firstOpenDayIndex
        : 0;
  const hasSelection = Number.isFinite(selectedMs);
  const isInvalid = Boolean(invalid || error);

  // Cambiando giorno, porta in vista lo slot già scelto (l'orario resta se
  // esiste anche nel nuovo giorno): senza, la selezione sarebbe fuori dallo
  // scroll interno e sembrerebbe sparita.
  const selectedSlotRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    selectedSlotRef.current?.scrollIntoView({ block: "nearest" });
  }, [dayKey]);

  return (
    <div className="space-y-2">
      <span
        id={labelId}
        className={cn(
          "block text-xs uppercase tracking-wider font-medium",
          isInvalid ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
        )}
      >
        {label}
      </span>

      {/* `aria-invalid` non esiste sul role="group": l'errore arriva dal
          role="alert" collegato via aria-describedby, e dal label in danger. */}
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
      >
        <div className="-mx-5 px-5">
          <div
            role="group"
            aria-label="Giorno"
            className="flex snap-x gap-2 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {days.map((day, index) => {
              const selected = day.key === dayKey;
              return (
                <button
                  key={day.key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={day.ariaLabel}
                  disabled={disabled || !dayHasSlots.get(day.key)}
                  ref={index === focusDayIndex ? focusRef : undefined}
                  onClick={() => handleDaySelect(day)}
                  className={cn(
                    DAY_CLASS,
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {firstEnabledIndex === -1 ? (
          <p className="mt-1 rounded-control bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            Nessun orario disponibile in questo giorno. Scegli un&apos;altra
            data.
          </p>
        ) : (
          <div
            key={dayKey}
            role="group"
            aria-label="Ora"
            className="mt-1 -mx-1 -mb-1 grid max-h-44 grid-cols-4 gap-2 overflow-y-auto overscroll-contain p-1"
          >
            {visibleSlots.map((slot) => {
              const selected =
                hasSelection && new Date(slot.iso).getTime() === selectedMs;
              return (
                <button
                  key={slot.time}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Ore ${slot.time}`}
                  disabled={disabled || slot.disabled}
                  ref={selected ? selectedSlotRef : undefined}
                  onClick={() => onChange(slot.iso)}
                  className={cn(
                    SLOT_CLASS,
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-transparent bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)]",
                  )}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
