"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  MapPin,
  MapPinOff,
  Plus,
  RotateCcw,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NextHighlight } from "@/components/motion/next-highlight";
import { StepTransition } from "@/components/motion/step-transition";
import { SuccessPop } from "@/components/motion/success-pop";
import { LibraryShowcase } from "./library-showcase";
import { cn } from "@/lib/utils";

const STYLEGUIDE_VERSION = "1.0";

const SECTIONS = [
  { id: "colori", index: "01", label: "Colori" },
  { id: "tipografia", index: "02", label: "Tipografia" },
  { id: "spacing", index: "03", label: "Spacing" },
  { id: "forma", index: "04", label: "Radius e ombre" },
  { id: "scale", index: "05", label: "Scale" },
  { id: "stack", index: "06", label: "Stack" },
  { id: "motion", index: "07", label: "Motion" },
  { id: "componenti", index: "08", label: "Componenti" },
  { id: "librerie", index: "09", label: "Librerie" },
  { id: "stati", index: "10", label: "Stati di pagina" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
type SheetKind = "demo" | "lobby" | null;

interface ColorToken {
  name: string;
  use: string;
  kind: "fill" | "text" | "line";
  /** Token di sfondo su cui mostrare il colore, per i foreground. */
  on?: string;
}

const COLOR_TOKENS: ColorToken[] = [
  { name: "--bg-base", use: "Sfondo della pagina", kind: "fill" },
  { name: "--bg-surface", use: "Card, input, liste", kind: "fill" },
  { name: "--bg-elevated", use: "Sheet, nav, elementi sopra la surface", kind: "fill" },
  { name: "--text-primary", use: "Titoli e testo principale", kind: "text" },
  { name: "--text-secondary", use: "Sottotitoli, orari, metadati", kind: "text" },
  { name: "--text-muted", use: "Testo attenuato, metadati, placeholder; 4,67:1 anche su elevated", kind: "text" },
  { name: "--accent", use: "CTA primaria, stato attivo, focus", kind: "fill" },
  { name: "--accent-hover", use: "Hover della CTA", kind: "fill" },
  { name: "--accent-subtle", use: "Sfondo badge accent e chip", kind: "fill" },
  { name: "--accent-foreground", use: "Testo e icone sopra accent", kind: "text", on: "--accent" },
  { name: "--success", use: "Stati positivi, check-in (teal)", kind: "fill" },
  { name: "--danger", use: "Errori e azioni distruttive", kind: "fill" },
  { name: "--danger-foreground", use: "Testo e icone sopra danger", kind: "text", on: "--danger" },
  { name: "--warning", use: "Avvisi, lobby in corso", kind: "fill" },
  { name: "--cool-muted", use: "Bordi, scrollbar, elementi freddi", kind: "line" },
  { name: "--border", use: "Bordi neutri di card e input", kind: "line" },
  { name: "--border-strong", use: "Bordi più visibili, separatori", kind: "line" },
  { name: "--overlay", use: "Backdrop di sheet e modal", kind: "fill" },
  { name: "--focus-ring", use: "Anello di focus (uguale ad accent)", kind: "line" },
];

const TINT_TOKENS = [
  "--success-dark",
  "--danger-dark",
  "--warning-dark",
] as const;

interface TypeStep {
  px: number;
  cls: string;
  /** Token della scala display, quando esiste. */
  token?: string;
  display?: boolean;
  weight: string;
  lh: number;
  sample: string;
  use: string;
}

const TYPE_SCALE: TypeStep[] = [
  {
    px: 40,
    cls: "text-display-lg",
    token: "--text-display-lg",
    display: true,
    weight: "font-extrabold",
    lh: 1.05,
    sample: "Gioca in strada",
    use: "Hero, numeri grandi",
  },
  {
    px: 32,
    cls: "text-display",
    token: "--text-display",
    display: true,
    weight: "font-bold",
    lh: 1.1,
    sample: "Partite vicine",
    use: "Titolo di pagina",
  },
  {
    px: 28,
    cls: "text-display-sm",
    token: "--text-display-sm",
    display: true,
    weight: "font-bold",
    lh: 1.15,
    sample: "Campi in zona",
    use: "Titolo di sezione",
  },
  {
    px: 24,
    cls: "text-2xl",
    display: true,
    weight: "font-bold",
    lh: 1.25,
    sample: "Dettagli della lobby",
    use: "Titolo secondario",
  },
  {
    px: 20,
    cls: "text-xl",
    display: true,
    weight: "font-semibold",
    lh: 1.25,
    sample: "Sottotitolo di blocco",
    use: "Titolo di card",
  },
  {
    px: 18,
    cls: "text-lg",
    weight: "font-semibold",
    lh: 1.4,
    sample: "Dettagli della lobby",
    use: "Titolo secondario",
  },
  {
    px: 16,
    cls: "text-base",
    weight: "font-normal",
    lh: 1.5,
    sample: "Il campo è in via Giolitti, ingresso dal cortile.",
    use: "Testo, input, button",
  },
  {
    px: 14,
    cls: "text-sm",
    weight: "font-normal",
    lh: 1.5,
    sample: "Oggi, 19:30 · 3/6 giocatori",
    use: "Orari, contatori, sottotitoli",
  },
  {
    px: 12,
    cls: "text-xs",
    weight: "font-medium",
    lh: 1.4,
    sample: "Aperta",
    use: "Badge e metadati",
  },
  {
    px: 11,
    cls: "text-label",
    token: "--text-label",
    weight: "font-medium",
    lh: 1.2,
    sample: "Mappa",
    use: "Etichette della bottom nav",
  },
];

const SPACING_STEPS = [
  { px: 4, name: "gap-1", use: "Distanze minime tra icona e testo" },
  { px: 8, name: "gap-2", use: "Spazi stretti interni" },
  { px: 12, name: "gap-3", use: "Padding interno di card e liste" },
  { px: 16, name: "gap-4", use: "Padding standard di card e sheet" },
  { px: 20, name: "p-5", use: "Padding del bottom sheet" },
  { px: 24, name: "gap-6", use: "Distanza tra sezioni" },
  { px: 32, name: "gap-8", use: "Separazione tra blocchi macro" },
];

const SPACING_LEVELS = [
  {
    level: "Micro",
    steps: "4 · 8 px",
    token: "gap-1 · gap-2",
    use: "Icona e testo, spazi interni stretti, distanza tra chip",
  },
  {
    level: "Medio",
    steps: "12 · 16 · 20 px",
    token: "gap-3 · gap-4 · p-5",
    use: "Padding di card, liste e sheet, ritmo dei form",
  },
  {
    level: "Macro",
    steps: "24 · 32 px",
    token: "gap-6 · gap-8",
    use: "Distanza tra sezioni e blocchi",
  },
];

const RADIUS_STEPS = [
  {
    token: "--radius-control-sm",
    cls: "rounded-control-sm",
    value: "8 px",
    use: "Button sm, input compatti",
  },
  {
    token: "--radius-control",
    cls: "rounded-control",
    value: "10 px",
    use: "Button default e input",
  },
  {
    token: "--radius-card",
    cls: "rounded-card",
    value: "12 px",
    use: "Card e button icon",
  },
  {
    token: "--radius-sheet",
    cls: "rounded-t-sheet",
    value: "20 px",
    use: "Bottom sheet, solo alto",
  },
  {
    token: "--radius-chip",
    cls: "rounded-chip",
    value: "9999 px",
    use: "Badge, chip, FAB",
  },
];

const SCALE_TOKENS = [
  "--text-label",
  "--text-display-sm",
  "--text-display",
  "--text-display-lg",
  "--radius-control-sm",
  "--radius-control",
  "--radius-card",
  "--radius-sheet",
  "--radius-chip",
] as const;

const SHADOW_STEPS = [
  { cls: "shadow", use: "Card in rilievo, raro" },
  { cls: "shadow-md", use: "Elementi flottanti leggeri" },
  { cls: "shadow-lg", use: "FAB, sheet, toast" },
];

const MOTION_TOKENS = [
  { token: "--motion-fast", use: "Press, hover, cambio di colore" },
  { token: "--motion-base", use: "Cambio di stato, comparsa breve" },
  { token: "--motion-slow", use: "Ingresso di uno step, apertura sheet" },
  { token: "--motion-success", use: "Pop di conferma" },
  { token: "--ease-standard", use: "Fade, slide, press: la curva normale" },
  { token: "--ease-elastic", use: "Solo pop e scale: rimbalzo breve" },
] as const;

type StackStatus = "presente" | "da installare" | "opzionale";

interface StackEntry {
  pkg: string;
  role: string;
  license: string;
  status: StackStatus;
}

const STACK_LIBRARIES: StackEntry[] = [
  {
    pkg: "@base-ui/react",
    role: "Headless per dialog, drawer, popover, menu, select, tabs, accordion, tooltip",
    license: "MIT",
    status: "da installare",
  },
  {
    pkg: "sonner",
    role: "Toast, 9 kB, zero dipendenze",
    license: "MIT",
    status: "da installare",
  },
  {
    pkg: "react-hook-form",
    role: "Form non controllati, un solo re-render al submit",
    license: "MIT",
    status: "da installare",
  },
  {
    pkg: "zod",
    role: "Validazione e schema condiviso tra client e server",
    license: "MIT",
    status: "da installare",
  },
  {
    pkg: "motion",
    role: "Animazioni dove CSS non basta: drag dello sheet, exit, layout",
    license: "MIT",
    status: "da installare",
  },
  {
    pkg: "@tanstack/react-virtual",
    role: "Liste lunghe, oltre ~50 righe visibili",
    license: "MIT",
    status: "opzionale",
  },
  {
    pkg: "cmdk",
    role: "Command palette, solo se nasce il caso d'uso",
    license: "MIT",
    status: "opzionale",
  },
  {
    pkg: "lucide-react",
    role: "Icone",
    license: "ISC",
    status: "presente",
  },
  {
    pkg: "clsx",
    role: "Composizione di className",
    license: "MIT",
    status: "presente",
  },
  {
    pkg: "tailwind-merge",
    role: "Merge delle classi Tailwind in cn()",
    license: "MIT",
    status: "presente",
  },
];

const STACK_AVOID = [
  { name: "Vaul", reason: "sheet non mantenuto" },
  { name: "Tremor", reason: "fermo al 2025" },
  { name: "Park UI", reason: "fermo al 2024" },
  { name: "Heroicons", reason: "fermo al 2024, le icone sono lucide" },
  { name: "MUI · antd · Chakra · Mantine", reason: "secondo design system" },
  { name: "Recharts", reason: "146 kB per grafici che non servono" },
  { name: "@dnd-kit/react", reason: "0.x, API non stabile" },
  { name: "Radix + Base UI", reason: "due primitive per lo stesso ruolo" },
];

const STACK_STATUS_CLASS: Record<StackStatus, string> = {
  presente: "border-[var(--accent)]/30 bg-[var(--accent-subtle)] text-[var(--accent)]",
  "da installare":
    "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]",
  opzionale:
    "border-[var(--cool-muted)]/40 bg-transparent text-[var(--text-secondary)]",
};

const BUTTON_VARIANTS: Array<{
  variant: "primary" | "secondary" | "ghost" | "danger";
  label: string;
}> = [
  { variant: "primary", label: "primary" },
  { variant: "secondary", label: "secondary" },
  { variant: "ghost", label: "ghost" },
  { variant: "danger", label: "danger" },
];

const LOBBY_PLAYERS = ["Marco", "Giulia", "Sara"];

function Section({
  id,
  index,
  title,
  intro,
  children,
}: {
  id: SectionId;
  index: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-12 scroll-mt-24 border-t border-[var(--cool-muted)]/25 pt-10 first:mt-0 first:border-t-0 first:pt-0 lg:scroll-mt-10"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs tabular-nums text-[var(--accent)]">
            {index}
          </span>
          <h2 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-[var(--text-primary)]">
            {title}
          </h2>
        </div>
        <p className="max-w-[460px] text-sm leading-relaxed text-[var(--text-secondary)] sm:text-right">
          {intro}
        </p>
      </div>
      {children}
    </section>
  );
}

function SubSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-10 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        {note ? (
          <p className="text-label text-[var(--text-secondary)]">{note}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Specimen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatusTag({ status }: { status: StackStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 py-0.5 text-label",
        STACK_STATUS_CLASS[status]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-label font-medium text-[var(--text-secondary)]"
    >
      {children}
    </label>
  );
}

/**
 * Demo deterministica delle primitive di pipeline (d7): niente dati reali,
 * solo i tre componenti. È la superficie su cui gira
 * `tests/e2e/motion-pipelines.spec.ts`, anche con reduced motion.
 */
function PipelineMotionDemo() {
  const [step, setStep] = useState<"uno" | "due">("uno");
  const [popRun, setPopRun] = useState(0);
  const [highlightRun, setHighlightRun] = useState(0);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
        <p className="text-sm font-medium">StepTransition</p>
        <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
          entra 250 ms · esce 200 ms
        </p>
        <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)] p-3">
          <StepTransition
            stepKey={step}
            className="flex w-full items-center justify-center"
          >
            <span
              data-testid="pipe-step"
              className="rounded-control-sm border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 py-2 text-sm text-[var(--text-primary)]"
            >
              {step === "uno" ? "Passo 1: posizione" : "Passo 2: conferma"}
            </span>
          </StepTransition>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 gap-2"
            onClick={() => setStep("uno")}
          >
            Passo 1
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setStep("due")}
          >
            Passo 2
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
        <p className="text-sm font-medium">SuccessPop</p>
        <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
          pop 400 ms · una sola volta
        </p>
        <div className="mt-3 flex min-h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)] p-3">
          <div key={popRun} data-testid="pipe-success" className="w-full">
            <SuccessPop
              title="Check-in effettuato"
              description="Check-in attivo fino alle 19:40."
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-3 gap-2"
          onClick={() => setPopRun((n) => n + 1)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Ripeti
        </Button>
      </div>

      <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
        <p className="text-sm font-medium">NextHighlight</p>
        <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
          ring accent · sfuma al primo tap
        </p>
        <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)] p-3">
          <div key={highlightRun} className="w-full max-w-[220px]">
            <NextHighlight>
              <span
                data-testid="pipe-highlight"
                className="block rounded-control-sm bg-[var(--accent-subtle)] px-4 py-2 text-center text-sm font-medium text-[var(--text-primary)]"
              >
                Sei dentro
              </span>
            </NextHighlight>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-3 gap-2"
          onClick={() => setHighlightRun((n) => n + 1)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Ripristina
        </Button>
      </div>
    </div>
  );
}

export function StyleguideClient() {
  const [activeSection, setActiveSection] = useState<SectionId>("colori");
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [today, setToday] = useState("");
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [retryState, setRetryState] = useState<"error" | "loading" | "success">(
    "error"
  );
  const [motionRun, setMotionRun] = useState({
    fade: 0,
    scale: 0,
    pop: 0,
  });
  const navListRef = useRef<HTMLUListElement>(null);

  // I valori dei token arrivano dal browser, mai scritti a mano.
  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const token of COLOR_TOKENS) {
      next[token.name] = computed.getPropertyValue(token.name).trim();
    }
    for (const token of TINT_TOKENS) {
      next[token] = computed.getPropertyValue(token).trim();
    }
    for (const token of SCALE_TOKENS) {
      next[token] = computed.getPropertyValue(token).trim();
    }
    for (const token of MOTION_TOKENS) {
      next[token.token] = computed.getPropertyValue(token.token).trim();
    }
    setTokenValues(next);
  }, []);

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date())
    );
  }, []);

  // Indice attivo: sezione più in alto che ha superato la barra sticky.
  useEffect(() => {
    const update = () => {
      let current: SectionId = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 140) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // La striscia dell'indice, su mobile, accompagna la sezione attiva.
  useEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLAnchorElement>(
      `[data-section="${activeSection}"]`
    );
    if (!item) return;
    const left = item.offsetLeft - list.clientWidth / 2 + item.clientWidth / 2;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    list.scrollTo({
      left: Math.max(0, left),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeSection]);

  // Riprova finta: errore → caricamento → recupero.
  useEffect(() => {
    if (retryState !== "loading") return;
    const timer = window.setTimeout(() => setRetryState("success"), 900);
    return () => window.clearTimeout(timer);
  }, [retryState]);

  const handleNavClick = (
    event: MouseEvent<HTMLAnchorElement>,
    id: SectionId
  ) => {
    const target = document.getElementById(id);
    setActiveSection(id);
    if (!target) return;
    event.preventDefault();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const replayMotion = (key: keyof typeof motionRun) => {
    setMotionRun((previous) => ({ ...previous, [key]: previous[key] + 1 }));
  };

  return (
    <div className="min-h-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="h-1 w-full bg-[var(--accent)]" aria-hidden="true" />

      <header>
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pb-12 lg:pt-16">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-label font-medium text-[var(--text-secondary)]">
              Drop-In · Design System · tema dark
            </p>
            <p className="font-mono text-label tabular-nums text-[var(--text-secondary)]">
              DS {STYLEGUIDE_VERSION}
            </p>
          </div>

          <h1 className="mt-6 font-[family-name:var(--font-syne)] text-[clamp(2.5rem,9vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.02em] text-[var(--text-primary)]">
            Styleguide
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            solo sviluppo — non linkata nell&apos;app
          </p>

          <p className="mt-6 max-w-[560px] text-sm leading-relaxed text-[var(--text-secondary)]">
            Token, tipografia, spazi e componenti reali, tutti in un solo posto.
            Tema unico dark. I valori di colori, radius e type scale sono letti
            dal browser a runtime: se un token cambia in{" "}
            <span className="font-mono text-[13px]">app/globals.css</span>,
            questa pagina lo mostra senza modifiche.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--cool-muted)]/25 pt-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-label text-[var(--text-secondary)]">Versione</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {STYLEGUIDE_VERSION}
              </dd>
            </div>
            <div>
              <dt className="text-label text-[var(--text-secondary)]">
                Aggiornata
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {today || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-label text-[var(--text-secondary)]">Ambito</dt>
              <dd className="mt-0.5 font-medium tabular-nums">360 → 1280 px</dd>
            </div>
            <div>
              <dt className="text-label text-[var(--text-secondary)]">Fonte</dt>
              <dd className="mt-0.5 font-medium">Design system v1 · dark</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-14 lg:px-8">
        <nav
          aria-label="Indice della styleguide"
          className="sticky top-0 z-40 -mx-4 border-b border-[var(--cool-muted)]/25 bg-[var(--bg-base)]/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:mx-0 lg:h-screen lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-10 lg:backdrop-blur-none"
        >
          <p className="hidden text-label font-medium text-[var(--text-secondary)] lg:mb-3 lg:block">
            Indice
          </p>
          <ul
            ref={navListRef}
            className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-0"
          >
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    data-section={section.id}
                    onClick={(event) => handleNavClick(event, section.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-control-sm px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                      active
                        ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]",
                      "lg:min-h-[38px]"
                    )}
                  >
                    <span className="font-mono text-label tabular-nums">
                      {section.index}
                    </span>
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="pb-24 pt-8 lg:pt-10">
          <Section
            id="colori"
            index="01"
            title="Colori"
            intro="Diciannove token semantici, nessun colore fuori da app/globals.css. Tema unico dark: ogni campione legge il token vero dal browser."
          >
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {COLOR_TOKENS.map((token) => (
                <li
                  key={token.name}
                  className="flex items-stretch overflow-hidden rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] sm:block"
                >
                  <div
                    className={cn(
                      "flex w-16 shrink-0 items-center justify-center border-r border-[var(--cool-muted)]/20 sm:h-20 sm:w-full sm:border-b sm:border-r-0",
                      token.kind !== "fill" && "bg-[var(--bg-elevated)]"
                    )}
                    style={
                      token.kind === "fill"
                        ? { backgroundColor: `var(${token.name})` }
                        : token.on
                          ? { backgroundColor: `var(${token.on})` }
                          : undefined
                    }
                  >
                    {token.kind === "text" ? (
                      <span
                        className="font-[family-name:var(--font-syne)] text-xl font-semibold leading-none sm:text-display-sm"
                        style={{ color: `var(${token.name})` }}
                      >
                        Aa
                      </span>
                    ) : null}
                    {token.kind === "line" ? (
                      <span
                        className="h-[2px] w-8 rounded-full sm:w-16"
                        style={{ backgroundColor: `var(${token.name})` }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 p-3">
                    <p className="text-[13px] font-medium">{token.name}</p>
                    <p className="mt-1 break-all font-mono text-label leading-snug text-[var(--text-secondary)]">
                      {tokenValues[token.name] || "lettura…"}
                    </p>
                    <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">
                      {token.use}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <p className="mb-2 text-label text-[var(--text-secondary)]">
                Derivate: testo su tinta, usate dai badge su fondo scuro.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-baseline gap-2 rounded-chip border border-[var(--success)]/25 bg-[var(--success)]/20 px-3 py-1.5 text-xs text-[var(--success-dark)]">
                  <span className="font-medium">success-dark</span>
                  <span className="font-mono text-label">
                    {tokenValues["--success-dark"] || "…"}
                  </span>
                </span>
                <span className="inline-flex items-baseline gap-2 rounded-chip border border-[var(--danger)]/25 bg-[var(--danger)]/20 px-3 py-1.5 text-xs text-[var(--danger-dark)]">
                  <span className="font-medium">danger-dark</span>
                  <span className="font-mono text-label">
                    {tokenValues["--danger-dark"] || "…"}
                  </span>
                </span>
                <span className="inline-flex items-baseline gap-2 rounded-chip border border-[var(--warning)]/25 bg-[var(--warning)]/20 px-3 py-1.5 text-xs text-[var(--warning-dark)]">
                  <span className="font-medium">warning-dark</span>
                  <span className="font-mono text-label">
                    {tokenValues["--warning-dark"] || "…"}
                  </span>
                </span>
              </div>
            </div>

            <p className="mt-6 max-w-[720px] text-xs leading-relaxed text-[var(--text-secondary)]">
              Il tema è unico e scuro: base, surface ed elevated sono tre grigi
              neutri. Il verde resta l&apos;accent; success è teal, danger è
              rosso corallo. I foreground scuri (accent e danger) esistono per
              il testo sopra i riempimenti pieni.
            </p>
          </Section>

          <Section
            id="tipografia"
            index="02"
            title="Tipografia"
            intro="Syne per i titoli, Source Sans 3 per tutto il resto. Scala da 11 px (label) a 40 px (display-lg); i token display vivono in app/globals.css."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="font-[family-name:var(--font-syne)] text-[64px] font-bold leading-none">
                    Aa
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-medium">Syne</p>
                    <p className="text-label text-[var(--text-secondary)]">
                      Display · 400–800
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[var(--text-secondary)]">
                  Titoli, numeri grandi, marchio.
                </p>
                <div className="mt-3 flex gap-3 font-[family-name:var(--font-syne)] text-sm">
                  <span className="font-normal">400</span>
                  <span className="font-medium">500</span>
                  <span className="font-semibold">600</span>
                  <span className="font-bold">700</span>
                  <span className="font-extrabold">800</span>
                </div>
              </div>

              <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[64px] font-normal leading-none">Aa</span>
                  <div className="text-right">
                    <p className="text-sm font-medium">Source Sans 3</p>
                    <p className="text-label text-[var(--text-secondary)]">
                      Body · 400–700
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[var(--text-secondary)]">
                  Testo, etichette, input e button.
                </p>
                <div className="mt-3 flex gap-3 text-sm">
                  <span className="font-normal">400</span>
                  <span className="font-medium">500</span>
                  <span className="font-semibold">600</span>
                  <span className="font-bold">700</span>
                </div>
              </div>
            </div>

            <ul className="mt-8">
              {TYPE_SCALE.map((step) => (
                <li
                  key={step.px}
                  className="grid gap-2 border-b border-[var(--cool-muted)]/15 py-4 last:border-0 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-6"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
                    <span className="font-mono text-xs tabular-nums text-[var(--accent)]">
                      {step.px} px
                    </span>
                    <span className="font-mono text-label text-[var(--text-secondary)] sm:mt-0.5 sm:block">
                      {step.cls} · lh {step.lh}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        step.cls,
                        step.weight,
                        step.display &&
                          "font-[family-name:var(--font-syne)]"
                      )}
                      style={{ lineHeight: step.lh }}
                    >
                      {step.sample}
                    </p>
                    <p className="mt-1 text-label text-[var(--text-secondary)]">
                      {step.use}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-control-sm bg-[var(--bg-surface)] p-4">
                <p className="mb-2 text-label text-[var(--text-secondary)]">
                  Titoli · line-height 1.05–1.25
                </p>
                <p
                  className="font-[family-name:var(--font-syne)] text-xl font-semibold"
                  style={{ lineHeight: 1.25 }}
                >
                  La palla entra solo se ci credi
                </p>
              </div>
              <div className="rounded-control-sm bg-[var(--bg-surface)] p-4">
                <p className="mb-2 text-label text-[var(--text-secondary)]">
                  Body · line-height 1.5
                </p>
                <p className="text-sm" style={{ lineHeight: 1.5 }}>
                  Il campo è in via Giolitti, ingresso dal cortile. Porta un
                  pallone: chi arriva primo sceglie la palla, gli altri giocano.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="spacing"
            index="03"
            title="Spacing"
            intro="Scala Tailwind con base 4 px, raggruppata in tre livelli: micro, medio, macro. Le barre sono larghezze reali, non proporzioni."
          >
            <ul className="space-y-3">
              {SPACING_STEPS.map((step) => (
                <li
                  key={step.px}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1"
                >
                  <span className="w-10 font-mono text-label tabular-nums text-[var(--accent)]">
                    {step.px}
                  </span>
                  <span className="w-10 shrink-0 sm:w-[140px]">
                    <span
                      className="block h-2 rounded-[1px] bg-[var(--accent)]"
                      style={{ width: `${step.px}px` }}
                    />
                  </span>
                  <span className="font-mono text-label text-[var(--text-secondary)]">
                    {step.name}
                  </span>
                  <span className="w-full text-label text-[var(--text-secondary)] sm:w-auto">
                    {step.use}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4 rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control-sm border border-dashed border-[var(--accent)] text-label font-medium text-[var(--accent)]"
                aria-hidden="true"
              >
                44
              </span>
              <div>
                <p className="text-sm font-medium">Touch target minimo 44 px</p>
                <p className="mt-0.5 text-label text-[var(--text-secondary)]">
                  Vale per ogni elemento tappabile: button sm, handle del sheet,
                  voci della nav.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="forma"
            index="04"
            title="Radius e ombre"
            intro="Cinque raggi tokenizzati, tutti in app/globals.css. Il raggio cresce con la dimensione dell'elemento."
          >
            <SubSection title="Radius" note="Valori vincolanti">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {RADIUS_STEPS.map((step) => (
                  <li key={step.cls} className="space-y-2">
                    <div className="flex h-16 items-end justify-start bg-[var(--bg-surface)] p-2">
                      <span
                        className={cn(
                          "h-full w-full border border-[var(--cool-muted)]/40 bg-[var(--bg-elevated)]",
                          step.cls
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-mono text-label text-[var(--text-primary)]">
                        {step.token}
                      </p>
                      <p className="text-label text-[var(--text-secondary)]">
                        {tokenValues[step.token] || step.value} · {step.use}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </SubSection>

            <SubSection title="Ombre" note="Livelli Tailwind esistenti">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {SHADOW_STEPS.map((step) => (
                  <li key={step.cls} className="space-y-3">
                    <div className="flex h-20 items-center justify-center rounded-card bg-[var(--bg-base)] p-4">
                      <span
                        className={cn(
                          "flex h-full w-full items-center justify-center rounded-card bg-[var(--bg-elevated)]",
                          step.cls
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-mono text-label">{step.cls}</p>
                      <p className="text-label text-[var(--text-secondary)]">
                        {step.use}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </SubSection>
          </Section>

          <Section
            id="scale"
            index="05"
            title="Scale"
            intro="Tre scale chiuse, tutte in app/globals.css: tipografia, radius e spacing. Nessun valore fuori scala."
          >
            <SubSection title="Tipografia" note="text-label → text-display-lg">
              <ul>
                {TYPE_SCALE.filter((step) => step.token).map((step) => (
                  <li
                    key={step.token}
                    className="grid gap-2 border-b border-[var(--cool-muted)]/15 py-3 last:border-0 sm:grid-cols-[150px_72px_130px_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                  >
                    <span className="font-mono text-label text-[var(--text-primary)]">
                      {step.token}
                    </span>
                    <span
                      className={cn(
                        step.cls,
                        "font-[family-name:var(--font-syne)] font-bold leading-none"
                      )}
                    >
                      Aa
                    </span>
                    <span className="font-mono text-label tabular-nums text-[var(--text-secondary)]">
                      {step.token
                        ? tokenValues[step.token] || `${step.px} px`
                        : `${step.px} px`}{" "}
                      · lh {step.lh}
                    </span>
                    <span className="text-label text-[var(--text-secondary)]">
                      {step.use}
                    </span>
                  </li>
                ))}
              </ul>
            </SubSection>

            <SubSection title="Radius" note="control-sm → chip">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {RADIUS_STEPS.map((step) => (
                  <li key={step.token} className="space-y-2">
                    <div className="flex h-16 items-center justify-center bg-[var(--bg-surface)] p-2">
                      <span
                        className={cn(
                          "h-12 w-full border border-[var(--border-strong)] bg-[var(--bg-elevated)]",
                          step.cls
                        )}
                      />
                    </div>
                    <p className="font-mono text-label text-[var(--text-primary)]">
                      {step.token}
                    </p>
                    <p className="font-mono text-label text-[var(--text-secondary)]">
                      {tokenValues[step.token] || step.value}
                    </p>
                    <p className="text-label leading-snug text-[var(--text-secondary)]">
                      {step.use}
                    </p>
                  </li>
                ))}
              </ul>
            </SubSection>

            <SubSection title="Spacing" note="micro · medio · macro">
              <ul className="grid gap-3 sm:grid-cols-3">
                {SPACING_LEVELS.map((level) => (
                  <li
                    key={level.level}
                    className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4"
                  >
                    <p className="text-sm font-semibold">{level.level}</p>
                    <p className="mt-0.5 font-mono text-label text-[var(--accent)]">
                      {level.steps}
                    </p>
                    <p className="mt-1 font-mono text-label text-[var(--text-secondary)]">
                      {level.token}
                    </p>
                    <p className="mt-2 text-label leading-relaxed text-[var(--text-secondary)]">
                      {level.use}
                    </p>
                  </li>
                ))}
              </ul>
            </SubSection>
          </Section>

          <Section
            id="stack"
            index="06"
            title="Stack"
            intro="Librerie ammesse per l'interfaccia. Codice e stile restano nostri: una libreria cambia come si costruisce un controllo, non come appare."
          >
            <SubSection title="Decise" note="nessuna installata">
              <div className="overflow-x-auto rounded-card border border-[var(--cool-muted)]/25">
                <table className="w-full border-collapse text-left sm:min-w-[560px]">
                  <thead className="max-sm:sr-only">
                    <tr className="border-b border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-label font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Pacchetto
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-label font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Ruolo
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-label font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Licenza
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-label font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        Stato
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {STACK_LIBRARIES.map((entry) => (
                      <tr
                        key={entry.pkg}
                        className="border-b border-[var(--cool-muted)]/15 last:border-0 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-3 max-sm:gap-y-1 max-sm:px-4 max-sm:py-3"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)] max-sm:w-full max-sm:px-0 max-sm:py-0">
                          {entry.pkg}
                        </td>
                        <td className="px-4 py-3 text-[13px] leading-snug text-[var(--text-secondary)] max-sm:w-full max-sm:px-0 max-sm:py-0">
                          {entry.role}
                        </td>
                        <td className="px-4 py-3 font-mono text-label text-[var(--text-secondary)] max-sm:px-0 max-sm:py-0">
                          {entry.license}
                        </td>
                        <td className="px-4 py-3 max-sm:px-0 max-sm:py-0">
                          <StatusTag status={entry.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SubSection>

            <SubSection title="Da evitare" note="motivo, non gusto">
              <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 sm:[&>li:nth-last-child(2)]:border-b-0">
                {STACK_AVOID.map((entry) => (
                  <li
                    key={entry.name}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--cool-muted)]/15 pb-2 text-[13px] last:border-0"
                  >
                    <span className="font-mono text-xs text-[var(--text-primary)]">
                      {entry.name}
                    </span>
                    <span className="text-label text-[var(--text-secondary)]">
                      {entry.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </SubSection>

            <Specimen className="mt-6">
              <p className="text-sm font-medium">Nessuna è installata</p>
              <p className="mt-1 max-w-[680px] text-label leading-relaxed text-[var(--text-secondary)]">
                Si installa solo dopo il test Base UI + Sonner su Safari iOS:
                drawer con drag e focus trap, toast dentro la safe-area,{" "}
                <span className="whitespace-nowrap font-mono">
                  prefers-reduced-motion
                </span>
                , nessun errore in console. Fino a lì valgono i componenti
                scritti a mano in{" "}
                <span className="whitespace-nowrap font-mono">components/ui</span>
                . Criteri e regole d&apos;uso in{" "}
                <a
                  href="https://github.com/rkestt/Drop-In/blob/master/docs/design/stack.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)]"
                >
                  docs/design/stack.md
                </a>
                .
              </p>
            </Specimen>
          </Section>

          <Section
            id="motion"
            index="07"
            title="Motion"
            intro="Quattro durate e due curve, tokenizzate in app/globals.css. I valori qui sotto arrivano dal browser, non da questa pagina."
          >
            <SubSection title="Token" note="letti dal browser">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MOTION_TOKENS.map((token) => (
                  <li
                    key={token.token}
                    className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-3"
                  >
                    <p className="font-mono text-label text-[var(--text-primary)]">
                      {token.token}
                    </p>
                    <p className="mt-1 break-all font-mono text-label leading-snug text-[var(--accent)]">
                      {tokenValues[token.token] || "lettura…"}
                    </p>
                    <p className="mt-1.5 text-label leading-snug text-[var(--text-secondary)]">
                      {token.use}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-label leading-relaxed text-[var(--text-secondary)]">
                Tailwind genera <span className="font-mono">ease-standard</span>{" "}
                e <span className="font-mono">ease-elastic</span> dalle curve. Le
                durate non hanno utility: si usano con{" "}
                <span className="font-mono">var(--motion-*)</span> o con{" "}
                <span className="font-mono">duration-&lt;ms&gt;</span>.
              </p>
            </SubSection>

            <SubSection title="Keyframe" note="classi esistenti, durate invariate">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)]">
                    <div key={motionRun.fade} className="flex h-28 w-full items-center justify-center">
                      <span className="block h-14 w-32 animate-fade-in-up rounded-control-sm border border-[var(--accent)]/30 bg-[var(--accent-subtle)]" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium">fadeInUp</p>
                  <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
                    400 ms · --ease-standard
                  </p>
                  <p className="mt-1 text-label text-[var(--text-secondary)]">
                    Ingresso di pagina e voci di lista.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-3 gap-2"
                    onClick={() => replayMotion("fade")}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Ripeti
                  </Button>
                </div>

                <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)]">
                    <div key={motionRun.scale} className="flex h-28 w-full items-center justify-center">
                      <span className="block h-14 w-14 animate-scale-in rounded-card bg-[var(--accent)]" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium">scaleIn</p>
                  <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
                    300 ms · --ease-elastic
                  </p>
                  <p className="mt-1 text-label text-[var(--text-secondary)]">
                    Comparsa di un elemento sopra gli altri.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-3 gap-2"
                    onClick={() => replayMotion("scale")}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Ripeti
                  </Button>
                </div>

                <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-control-sm bg-[var(--bg-surface)]">
                    <div key={motionRun.pop} className="flex h-28 w-full items-center justify-center">
                      <span className="flex h-14 w-14 animate-success-pop items-center justify-center rounded-full bg-[var(--success)] text-[var(--bg-base)]">
                        <Check className="h-7 w-7" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium">successPop</p>
                  <p className="mt-0.5 font-mono text-label leading-snug text-[var(--text-secondary)]">
                    500 ms · --ease-elastic
                  </p>
                  <p className="mt-1 text-label text-[var(--text-secondary)]">
                    Conferma del check-in riuscito.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-3 gap-2"
                    onClick={() => replayMotion("pop")}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Ripeti
                  </Button>
                </div>
              </div>

              <p className="mt-4 max-w-[680px] text-label leading-relaxed text-[var(--text-secondary)]">
                Le tre classi non cambiano durata:{" "}
                <span className="font-mono">--motion-*</span> è la scala per il
                motion nuovo e per i componenti che la leggono. Lo shimmer vive
                in <span className="font-mono">.animate-shimmer</span> (sezione
                Stati di pagina). Con{" "}
                <span className="font-mono">prefers-reduced-motion: reduce</span>{" "}
                tutte le durate scendono a 0.01 ms: l&apos;esito resta perché è
                anche in testo e stato.
              </p>
            </SubSection>

            <SubSection title="Pipeline" note="primitive d7, durate dai token">
              <PipelineMotionDemo />
              <p className="mt-3 max-w-[680px] text-label leading-relaxed text-[var(--text-secondary)]">
                Le tre primitive vivono in{" "}
                <span className="font-mono">components/motion/</span> e leggono
                le durate da{" "}
                <span className="font-mono">lib/motion/tokens.ts</span> (che
                rispecchia i token CSS: il test unitario lo verifica). Con{" "}
                <span className="font-mono">prefers-reduced-motion: reduce</span>{" "}
                non si muove nulla: stesso testo, stesso stato, nessun transform
                inline.
              </p>
            </SubSection>

            <div className="mt-6 border-l-2 border-[var(--accent)] pl-4">
              <p className="text-sm font-medium">
                Onboarding-first: il motion è funzionale alla guida, non
                decorativo
              </p>
              <p className="mt-1 max-w-[680px] text-label leading-relaxed text-[var(--text-secondary)]">
                Dice dove sei, qual è il prossimo controllo e com&apos;è andata.
                Fuori da una pipeline resta il default di{" "}
                <span className="font-mono">var(--motion-fast)</span>. Pattern
                completo in{" "}
                <a
                  href="https://github.com/rkestt/Drop-In/blob/master/docs/design/patterns/onboarding.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
                >
                  docs/design/patterns/onboarding.md
                </a>
                .
              </p>
            </div>
          </Section>

          <Section
            id="componenti"
            index="08"
            title="Componenti"
            intro="Componenti reali da components/ui, non copie: quello che provi qui è quello che finisce nell'app."
          >
            <SubSection title="Button" note="varianti × size, disabled, focus">
              <Specimen>
                <div className="space-y-3">
                  {BUTTON_VARIANTS.map(({ variant, label }) => (
                    <div
                      key={variant}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cool-muted)]/15 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="w-full shrink-0 font-mono text-label text-[var(--text-secondary)] sm:w-16">
                        {label}
                      </span>
                      <Button variant={variant}>Unisciti</Button>
                      <Button variant={variant} size="sm">
                        Apri
                      </Button>
                      <Button
                        variant={variant}
                        size="icon"
                        aria-label={`Esempio ${label} con icona`}
                      >
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-[var(--cool-muted)]/15 pt-4">
                  <p className="mb-2 font-mono text-label text-[var(--text-secondary)]">
                    disabled
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BUTTON_VARIANTS.map(({ variant, label }) => (
                      <Button key={variant} variant={variant} size="sm" disabled>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-[var(--cool-muted)]/15 pt-4">
                  <p className="mb-2 font-mono text-label text-[var(--text-secondary)]">
                    focus
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex rounded-control ring-2 ring-[var(--accent)] ring-offset-2">
                      <Button tabIndex={-1}>Unisciti</Button>
                    </span>
                    <p className="max-w-[320px] text-label leading-snug text-[var(--text-secondary)]">
                      Anello accent 2 px, offset 2 px. Nei componenti reali
                      compare solo con Tab.
                    </p>
                  </div>
                </div>
              </Specimen>
            </SubSection>

            <SubSection title="Input" note="default, focus, disabled, errore">
              <Specimen>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="sg-input-default">
                      Nome della lobby
                    </FieldLabel>
                    <Input
                      id="sg-input-default"
                      placeholder="Es. Partita veloce"
                    />
                    <p className="mt-1.5 text-label text-[var(--text-secondary)]">
                      Default: surface piena, bordo trasparente.
                    </p>
                  </div>

                  <div>
                    <FieldLabel htmlFor="sg-input-focus">Focus</FieldLabel>
                    <span className="block rounded-control ring-2 ring-[var(--accent)] ring-offset-2">
                      <Input
                        id="sg-input-focus"
                        tabIndex={-1}
                        defaultValue="Campo di Piazza Vittorio"
                      />
                    </span>
                    <p className="mt-1.5 text-label text-[var(--text-secondary)]">
                      Anello accent, bordo accent. Qui è mostrato in modo statico.
                    </p>
                  </div>

                  <div>
                    <FieldLabel htmlFor="sg-input-disabled">Disabled</FieldLabel>
                    <Input
                      id="sg-input-disabled"
                      placeholder="Non modificabile"
                      disabled
                      className="cursor-not-allowed opacity-50"
                    />
                    <p className="mt-1.5 text-label text-[var(--text-secondary)]">
                      opacity 50%, nessun pointer.
                    </p>
                  </div>

                  <div>
                    <FieldLabel htmlFor="sg-input-error">Errore</FieldLabel>
                    <Input
                      id="sg-input-error"
                      defaultValue="A"
                      aria-invalid="true"
                      aria-describedby="sg-input-error-message"
                      className="border-[var(--danger)]"
                    />
                    <p
                      id="sg-input-error-message"
                      className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--danger)]"
                    >
                      <CircleAlert
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      Il nome deve avere almeno 3 caratteri.
                    </p>
                  </div>
                </div>
                <p className="mt-4 border-t border-[var(--cool-muted)]/15 pt-3 text-label text-[var(--text-secondary)]">
                  L&apos;errore non è una variante del componente: bordo e
                  messaggio si passano dal chiamante, con{" "}
                  <span className="font-mono">aria-invalid</span> e{" "}
                  <span className="font-mono">aria-describedby</span>.
                </p>
              </Specimen>
            </SubSection>

            <SubSection title="Badge" note="default, accent, success, warning, danger">
              <Specimen>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Bozza</Badge>
                  <Badge variant="accent">Aperta</Badge>
                  <Badge variant="success">Confermata</Badge>
                  <Badge variant="warning">In corso</Badge>
                  <Badge variant="danger">Annullata</Badge>
                </div>
                <p className="mt-3 text-label text-[var(--text-secondary)]">
                  Testo 12 px maiuscolo con tracking wider. Elemento statico: non
                  è cliccabile e non ha stati. La variante accent tiene la tinta
                  e usa testo primary: con{" "}
                  <span className="font-mono">--accent</span> come testo sul
                  subtle scendeva a 3,87–4,48:1.
                </p>
              </Specimen>
            </SubSection>

            <SubSection title="Drawer" note="dialog, focus trap, swipe">
              <Specimen className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Apri un foglio reale</p>
                  <p className="mt-0.5 text-label text-[var(--text-secondary)]">
                    Chiude con Escape, tap sul backdrop o trascinamento verso il
                    basso.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setSheet("demo")}>
                  Apri drawer
                </Button>
              </Specimen>
            </SubSection>

            <SubSection title="Card lobby" note="pattern, non componente">
              <div className="max-w-[420px] space-y-3 rounded-card bg-[var(--bg-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate font-semibold text-[var(--text-primary)]">
                      Campo di Piazza Vittorio
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Oggi, 19:30
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        3/6
                      </span>
                    </div>
                  </div>
                  <Badge variant="accent">Aperta</Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                  {LOBBY_PLAYERS.map((player) => (
                    <span
                      key={player}
                      className="rounded-chip bg-[var(--accent-subtle)] px-2 py-0.5 text-label text-[var(--text-primary)]"
                    >
                      {player}
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setSheet("lobby")}
                >
                  Vedi
                </Button>
              </div>
            </SubSection>

            <SubSection title="Navigazione e FAB" note="anteprima a 360 px">
              <div className="mx-auto w-[360px] max-w-full">
                <div className="overflow-hidden rounded-card border border-[var(--cool-muted)]/30 bg-[var(--bg-base)] shadow-lg">
                  <div className="relative h-[220px] bg-[var(--bg-surface)]">
                    <p className="pl-4 pt-4 text-label text-[var(--text-secondary)]">
                      area mappa
                    </p>
                    <span
                      aria-hidden="true"
                      className="absolute bottom-4 right-4 inline-flex h-14 w-14 items-center justify-center rounded-chip bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg"
                    >
                      <Plus className="h-7 w-7" />
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="flex h-14 items-center justify-around border-t border-[var(--cool-muted)]/20 bg-[var(--bg-elevated)]"
                  >
                    <span className="flex h-14 w-16 flex-col items-center justify-center text-[var(--accent)]">
                      <MapPin className="h-6 w-6" />
                      <span className="mt-0.5 text-label font-medium">
                        Mappa
                      </span>
                    </span>
                    <span className="flex h-14 w-16 flex-col items-center justify-center text-[var(--text-secondary)]">
                      <User className="h-6 w-6" />
                      <span className="mt-0.5 text-label font-medium">
                        Profilo
                      </span>
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-label leading-relaxed text-[var(--text-secondary)]">
                  Nav alta 56 px con target 64×48; FAB 56 px in basso a destra
                  sulla mappa. La styleguide non aggiunge voci alla nav.
                </p>
              </div>
            </SubSection>
          </Section>

          <Section
            id="librerie"
            index="09"
            title="Librerie"
            intro="Componenti candidati da Base UI, Sonner, Motion, react-hook-form e zod. Sono qui per essere provati e scelti, non ancora adottati."
          >
            <LibraryShowcase />
          </Section>

          <Section
            id="stati"
            index="10"
            title="Stati di pagina"
            intro="Caricamento, vuoto, errore e disabilitato: ogni stato dice cosa sta succedendo e cosa fare."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                <p className="text-sm font-medium">Loading</p>
                <p className="mb-4 mt-0.5 text-label text-[var(--text-secondary)]">
                  Oltre 1 s di attesa: scheletro shimmer.
                </p>
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-3"
                >
                  <div className="h-3 w-2/3 animate-shimmer rounded-full" />
                  <div className="h-3 w-full animate-shimmer rounded-full" />
                  <div className="h-3 w-5/6 animate-shimmer rounded-full" />
                  <div className="h-20 w-full animate-shimmer rounded-card" />
                  <span className="sr-only">Caricamento dei contenuti</span>
                </div>
              </div>

              <div className="flex flex-col rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                <p className="text-sm font-medium">Empty</p>
                <p className="mb-4 mt-0.5 text-label text-[var(--text-secondary)]">
                  Icona 32 px, messaggio, poi un invito.
                </p>
                <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                  <MapPinOff
                    className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nessuna lobby dalle tue parti.
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Crea la prima e invita chi gioca con te.
                  </p>
                </div>
              </div>

              <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                <p className="text-sm font-medium">Error</p>
                <p className="mb-4 mt-0.5 text-label text-[var(--text-secondary)]">
                  Testo danger e azione di recupero accanto.
                </p>
                {retryState === "error" && (
                  <div>
                    <p className="text-sm text-[var(--danger)]">
                      Posizione non disponibile. Controlla i permessi e riprova.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => setRetryState("loading")}
                    >
                      Riprova
                    </Button>
                  </div>
                )}
                {retryState === "loading" && (
                  <div role="status" aria-live="polite" className="space-y-3">
                    <div className="h-3 w-3/4 animate-shimmer rounded-full" />
                    <div className="h-3 w-1/2 animate-shimmer rounded-full" />
                    <span className="sr-only">Nuovo tentativo in corso</span>
                  </div>
                )}
                {retryState === "success" && (
                  <div>
                    <p className="flex items-start gap-2 text-sm text-[var(--success-dark)]">
                      <CircleCheck
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      Riprova riuscita: i campi sono di nuovo visibili.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 -ml-3"
                      onClick={() => setRetryState("error")}
                    >
                      Torna all&apos;errore
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-card border border-[var(--cool-muted)]/25 bg-[var(--bg-elevated)] p-4">
                <p className="text-sm font-medium">Disabled</p>
                <p className="mb-4 mt-0.5 text-label text-[var(--text-secondary)]">
                  opacity 50%, pointer-events none, cursor not-allowed.
                </p>
                <div className="space-y-3">
                  <div>
                    <FieldLabel htmlFor="sg-disabled-state">
                      Campo non disponibile
                    </FieldLabel>
                    <Input
                      id="sg-disabled-state"
                      placeholder="In attesa di conferma"
                      disabled
                      className="cursor-not-allowed opacity-50"
                    />
                  </div>
                  <Button disabled className="w-full">
                    Unisciti
                  </Button>
                </div>
              </div>
            </div>
          </Section>
        </main>
      </div>

      <footer className="border-t border-[var(--cool-muted)]/25">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-label text-[var(--text-secondary)] sm:px-6 lg:px-8">
          <p>Drop-In · Design System · Styleguide {STYLEGUIDE_VERSION}</p>
          <p>Non linkata nell&apos;app. Visibile solo in sviluppo.</p>
        </div>
      </footer>

      <Drawer
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === "lobby" ? "Dettaglio lobby" : "Esempio di sheet"}
      >
        {sheet === "lobby" ? (
          <div className="space-y-4">
            <div>
              <p className="font-[family-name:var(--font-syne)] text-lg font-semibold">
                Campo di Piazza Vittorio
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Oggi, 19:30 · Basket 3v3 · 3/6 giocatori
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {LOBBY_PLAYERS.map((player) => (
                <span
                  key={player}
                  className="rounded-chip bg-[var(--accent-subtle)] px-2 py-0.5 text-label text-[var(--text-primary)]"
                >
                  {player}
                </span>
              ))}
            </div>
            <Button className="w-full" onClick={() => setSheet(null)}>
              Unisciti alla lobby
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Il foglio sale dal basso, intrappola il focus e restituisce il
              controllo al pulsante che lo ha aperto.
            </p>
            <div>
              <FieldLabel htmlFor="sg-drawer-nome">Nome campo</FieldLabel>
              <Input id="sg-drawer-nome" placeholder="Es. Campo Nomentano" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="accent">Aperta</Badge>
              <span className="text-sm text-[var(--text-secondary)]">
                3/6 giocatori
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSheet(null)}
              >
                Annulla
              </Button>
              <Button className="flex-1" onClick={() => setSheet(null)}>
                Conferma
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
