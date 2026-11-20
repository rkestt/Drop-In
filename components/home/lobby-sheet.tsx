"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Guscio del foglio "Partite vicine" (#89, spec `home-ricerca.md`).
 *
 * Foglio NON modale (`role="region"`, niente backdrop/trap/scroll-lock —
 * vedi `patterns/sheets.md` §"Sheet non modale"): la mappa sopra resta
 * cliccabile. Due snap misurati a runtime (striscia ↔ piena), mai quotati
 * sul `dvh` del mount; `piena = contenitore − nav − chrome − 8`, con la
 * tastiera il foglio si appoggia sul suo bordo (`visualViewport`).
 *
 * Il contenuto (striscia, elenco, risultati, vuoti) lo passa la pagina: qui
 * vivono solo handle, misura, drag/handoff, `inert` alternato e live region.
 */

export type LobbySheetSnap = "rail" | "full";

export interface LobbySheetMetrics {
  railHeight: number;
  dragging: boolean;
  keyboardOpen: boolean;
}

interface LobbySheetProps {
  snap: LobbySheetSnap;
  onSnapChange: (snap: LobbySheetSnap) => void;
  title: string;
  titleId: string;
  /** null = chip nascosto (caricamento/errore ricerca). */
  count: number | null;
  /** null = riga di contesto nascosta. A striscia non si renderizza mai. */
  meta: string | null;
  /** Ricerca attiva o campo focalizzato: una sola altezza, handle nascosto. */
  inSearch: boolean;
  announcement: string;
  /** Striscia orizzontale (a piena `display:none` + `inert`). */
  rail: React.ReactNode;
  /** Corpo verticale dello scroller (a striscia `display:none` + `inert`). */
  children: React.ReactNode;
  listRef: React.RefObject<HTMLDivElement | null>;
  handleRef: React.RefObject<HTMLButtonElement | null>;
  /** Chrome sopra la mappa (filtri + ricerca): la piena si ferma 8px sotto. */
  chromeRef: React.RefObject<HTMLDivElement | null>;
  /** Gesto giù dalla cima: chiude la ricerca o torna a striscia. */
  onCollapseRequest?: () => void;
  onMetrics?: (m: LobbySheetMetrics) => void;
  /** Azioni nella riga del titolo (es. Accedi, stale badge). */
  actions?: React.ReactNode;
}

const FALLBACK_RAIL = 144;
const FALLBACK_FULL = 544;
/** Soglia dito→foglio: sotto, scorre la lista; sopra, si muove il foglio. */
const HANDOFF_PX = 8;

export function LobbySheet({
  snap,
  onSnapChange,
  title,
  titleId,
  count,
  meta,
  inSearch,
  announcement,
  rail,
  children,
  listRef,
  handleRef,
  chromeRef,
  onCollapseRequest,
  onMetrics,
  actions,
}: LobbySheetProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const stripInnerRef = useRef<HTMLDivElement | null>(null);
  const stripOuterRef = useRef<HTMLDivElement | null>(null);
  const [heights, setHeights] = useState({ rail: FALLBACK_RAIL, full: FALLBACK_FULL });
  const [bottom, setBottom] = useState(0);
  const [kbOpen, setKbOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const bottomRef = useRef(0);
  const heightsRef = useRef(heights);
  const naturalStripRef = useRef(0);
  const handleHRef = useRef(44);
  const headHRef = useRef(36);
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean; lastH: number } | null>(null);
  const touchRef = useRef<{ y: number; x: number } | null>(null);
  const mouseRef = useRef<{ y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const snapRef = useRef(snap);
  const inSearchRef = useRef(inSearch);
  const stripHiddenRef = useRef(false);
  const metricsRef = useRef({ railHeight: FALLBACK_RAIL, dragging: false, keyboardOpen: false });

  snapRef.current = snap;
  inSearchRef.current = inSearch;
  heightsRef.current = heights;

  const onSnapChangeRef = useRef(onSnapChange);
  onSnapChangeRef.current = onSnapChange;
  const onCollapseRef = useRef(onCollapseRequest);
  onCollapseRef.current = onCollapseRequest;

  // prefers-reduced-motion → transizione 0,01ms, drag senza animazione.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const reportMetrics = (railHeight: number, isDragging: boolean, kb: boolean) => {
    const prev = metricsRef.current;
    if (
      prev.railHeight === railHeight &&
      prev.dragging === isDragging &&
      prev.keyboardOpen === kb
    ) {
      return;
    }
    metricsRef.current = { railHeight, dragging: isDragging, keyboardOpen: kb };
    onMetrics?.(metricsRef.current);
  };

  const measure = () => {
    const root = rootRef.current;
    if (!root) return;
    const band = root.parentElement;
    if (!(band instanceof HTMLElement)) return;
    const bandRect = band.getBoundingClientRect();
    const bandH = band.clientHeight;
    if (bandH <= 0) return;

    let chromeBottom = 112;
    const chrome = chromeRef.current;
    if (chrome) {
      const cb = Math.round(chrome.getBoundingClientRect().bottom - bandRect.top);
      if (cb > 0) chromeBottom = cb;
    }

    const nav = document.querySelector('nav[aria-label="Navigazione principale"]');
    const navH = nav instanceof HTMLElement && nav.offsetHeight > 0 ? nav.offsetHeight : 56;
    void navH; // La nav è sotto la banda nel flusso: il foglio è già sopra di lei.

    const handleEl = handleRef.current;
    if (handleEl && handleEl.offsetHeight > 0) handleHRef.current = handleEl.offsetHeight;
    if (headRef.current && headRef.current.offsetHeight > 0) {
      headHRef.current = headRef.current.offsetHeight;
    }
    // La striscia si misura solo da visibile (a piena è display:none):
    // l'ultima lettura buona resta quella giusta (prototipo: measureStrip).
    if (snapRef.current === "rail" && !inSearchRef.current && stripInnerRef.current) {
      const sh = stripInnerRef.current.offsetHeight;
      if (sh > 0) naturalStripRef.current = sh;
    }

    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    let nextBottom = 0;
    let avail: number;
    if (kb > 0 && vv) {
      const kbTop = vv.offsetTop + vv.height; // coordinate di layout
      const scrollY = window.scrollY;
      const bandBottomLayout = bandRect.bottom + scrollY;
      const bandTopLayout = bandRect.top + scrollY;
      nextBottom = Math.max(0, Math.round(bandBottomLayout - kbTop));
      avail = Math.round(kbTop - bandTopLayout - chromeBottom - HANDOFF_PX);
    } else {
      avail = Math.round(bandH - chromeBottom - HANDOFF_PX);
    }

    let rail = Math.round(handleHRef.current + headHRef.current + naturalStripRef.current);
    if (rail < FALLBACK_RAIL) rail = FALLBACK_RAIL;
    let full = avail;
    if (!inSearchRef.current && kb <= 0) full = Math.max(avail, rail + 140);
    // Mai oltre il contenitore, mai negativo; se lo spazio non basta nemmeno
    // per la striscia, striscia e piena collassano sulla stessa altezza
    // (quella disponibile): un'unica altezza, niente snap invertiti, drag
    // neutralizzato (span 0: moveDrag resta inchiodato, endDrag torna a rail).
    full = Math.max(0, Math.min(full, avail));
    if (full < rail) rail = full;

    setHeights((prev) => {
      if (Math.abs(prev.rail - rail) < 1 && Math.abs(prev.full - full) < 1) return prev;
      return { rail, full };
    });
    setBottom((prev) => (prev === nextBottom ? prev : nextBottom));
    bottomRef.current = nextBottom;
    // I controlli zoom di MapLibre stanno in basso a destra della mappa e il
    // foglio li coprirebbe: la banda espone l'altezza da scavalcare e una
    // regola con scope `#contenuto` li alza sopra il bordo (globals.css).
    // Stesso meccanismo per "Lista campi" (court-map.tsx, fuori dal foglio):
    // `snap` in dataset per nasconderlo a piena come il FAB.
    // Dettaglio d'integrazione Lane B: di court-map.tsx si tocca solo quel
    // controllo, niente altro.
    band.style.setProperty("--sheet-lift", `${Math.round((snapRef.current === "rail" ? rail : full) + nextBottom)}px`);
    band.style.setProperty("--sheet-chrome", `${Math.round(chromeBottom)}px`);
    band.dataset.sheetSnap = snapRef.current;
    band.dataset.sheetSearch = inSearchRef.current ? "on" : "off";
    setKbOpen((prev) => {
      const next = kb > 0;
      return prev === next ? prev : next;
    });
  };

  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Misura continua: ResizeObserver sulla banda + resize/orientationchange +
  // visualViewport (tastiera). Mai `dvh` quotato al mount.
  useEffect(() => {
    const root = rootRef.current;
    const band = root?.parentElement;
    if (!(band instanceof HTMLElement)) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => measureRef.current());
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(band);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
    };
  }, []);

  // Ri-misura dopo ogni render: teste/conteggi/striscia cambiano altezza
  // (lobby caricate, query digitata). I setState sono guardati (<1px = noop).
  useEffect(() => {
    const raf = requestAnimationFrame(() => measureRef.current());
    return () => cancelAnimationFrame(raf);
  });

  // A striscia l'elenco non prende fuoco, a piena la testa è fuori dal flusso:
  // `inert` + `aria-hidden` alternati (prototipo: applyStrip). Durante il drag
  // la testa si accorcia nel primo terzo del gesto, senza fade né doppioni.
  const stripHidden = snap === "full" || inSearch;
  stripHiddenRef.current = stripHidden;
  const listHidden = snap === "rail" && !inSearch;

  const applyStripProgress = (p: number) => {
    const outer = stripOuterRef.current;
    if (!outer) return;
    const q = Math.min(1, p / 0.35);
    if (q >= 1) {
      outer.style.display = "none";
    } else {
      outer.style.display = "";
      outer.style.height = `${Math.round(naturalStripRef.current * (1 - q))}px`;
    }
  };

  const clearStripInline = () => {
    const outer = stripOuterRef.current;
    if (!outer) return;
    outer.style.height = "";
    // Il `display` resta di proprietà di React (`display:none` quando la
    // striscia è nascosta): dopo un drag lo si riallinea allo stato, mai
    // resettato alla cieca. Il reset cieco, nell'effect al cambio snap,
    // annullava il `display:none` di React e la striscia restava visibile
    // (e alta ~72px) a foglio pieno: duplicato visivo dell'elenco.
    outer.style.display = stripHiddenRef.current ? "none" : "";
  };

  const currentHeight = () => {
    const h = heightsRef.current;
    return snapRef.current === "rail" ? h.rail : h.full;
  };

  const startDrag = (y: number) => {
    const root = rootRef.current;
    if (!root || dragRef.current) return;
    const current = root.offsetHeight || currentHeight();
    dragRef.current = { startY: y, startH: current, moved: false, lastH: current };
    // Congela subito: con `height` rimosso dallo style la sezione
    // scatterebbe ad altezza contenuto per un frame.
    root.style.height = `${Math.round(current)}px`;
    setDragging(true);
  };

  const moveDrag = (y: number) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root) return;
    const dy = y - drag.startY;
    if (!drag.moved && Math.abs(dy) < HANDOFF_PX) return;
    drag.moved = true;
    const h = heightsRef.current;
    const next = Math.min(h.full, Math.max(h.rail, drag.startH - dy));
    drag.lastH = next;
    root.style.height = `${Math.round(next)}px`;
    const span = h.full - h.rail;
    applyStripProgress(span <= 0 ? 1 : (next - h.rail) / span);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    const root = rootRef.current;
    setDragging(false);
    reportMetrics(heightsRef.current.rail, false, kbOpen);
    if (!drag || !root) return;
    if (!drag.moved) {
      dragRef.current = null;
      setDragging(false);
      root.style.height = "";
      clearStripInline();
      return;
    }
    suppressClickRef.current = true;
    const h = heightsRef.current;
    // L'altezza del rilascio è l'ultima del drag, non quella corrente del
    // DOM (lo style inline è ancora quello seguito col dito).
    const settled = drag.lastH;
    root.style.height = "";
    clearStripInline();
    const nearest: LobbySheetSnap =
      Math.abs(settled - h.rail) <= Math.abs(settled - h.full) ? "rail" : "full";
    if (inSearchRef.current && nearest !== "full") {
      onCollapseRef.current?.();
      return;
    }
    onSnapChangeRef.current(nearest);
  };

  // Riporta le metriche quando cambiano fuori dal drag (rail misurato, kb).
  useEffect(() => {
    reportMetrics(heights.rail, dragging, kbOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heights.rail, dragging, kbOpen]);

  // A piena la prima riga sta in cima (prototipo: setSnap azzera lo scroll).
  // Il ripristino dello scroll alla chiusura ricerca lo gestisce la pagina
  // in rAF, quindi vince sul reset.
  const prevSnapRef = useRef(snap);
  useEffect(() => {
    if (prevSnapRef.current !== snap) {
      prevSnapRef.current = snap;
      clearStripInline();
      if (snap === "full" && listRef.current) listRef.current.scrollTop = 0;
    }
  }, [snap, listRef]);

  const cycle = () => {
    onSnapChangeRef.current(snapRef.current === "rail" ? "full" : "rail");
  };

  /** Handoff scroll ↔ drag ai bordi: il foglio prende il gesto solo se la
   *  lista è in cima e il dito va giù, o in fondo e va su (soglia 8px). */
  useEffect(() => {
    const scroller = listRef.current;
    if (!scroller) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchRef.current = null;
        return;
      }
      // iOS chiude la tastiera quando si trascina la lista.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === "search") active.blur();
      touchRef.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = touchRef.current;
      if (!t || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      if (!dragRef.current) {
        const dy = y - t.y;
        if (Math.abs(dy) < HANDOFF_PX) return;
        const atTop = scroller.scrollTop <= 0;
        if (dy > 0 && atTop) {
          if (inSearchRef.current) {
            touchRef.current = null;
            onCollapseRef.current?.();
            return;
          }
          if (snapRef.current === "full") {
            startDrag(y);
            setDragging(true);
          } else {
            touchRef.current = null;
            return;
          }
        } else {
          // A metà lista il gesto resta allo scroll, mai al foglio.
          touchRef.current = null;
          return;
        }
        void x;
      }
      e.preventDefault();
      moveDrag(y);
    };
    const onTouchEnd = () => {
      if (dragRef.current) endDrag();
      touchRef.current = null;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      mouseRef.current = { y: e.clientY };
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("pointerdown", onPointerDown);
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef, snap, inSearch]);

  // Mouse sullo scroller: stesso handoff, senza eventi touch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: PointerEvent) => {
      const m = mouseRef.current;
      if (!m || e.pointerType !== "mouse") return;
      if (!dragRef.current) {
        const dy = e.clientY - m.y;
        if (Math.abs(dy) < HANDOFF_PX) return;
        const scroller = listRef.current;
        if (
          dy > 0 &&
          scroller &&
          scroller.scrollTop <= 0 &&
          snapRef.current === "full" &&
          !inSearchRef.current
        ) {
          startDrag(e.clientY);
        } else {
          mouseRef.current = null;
          return;
        }
      }
      e.preventDefault();
      moveDrag(e.clientY);
    };
    const onUp = () => {
      if (dragRef.current && mouseRef.current) endDrag();
      mouseRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef]);

  // Swipe verticale sulla striscia: su apre, orizzontale scorre (pan-x).
  useEffect(() => {
    const strip = stripInnerRef.current;
    if (!strip) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchRef.current = null;
        return;
      }
      touchRef.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = touchRef.current;
      if (!t || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      if (!dragRef.current) {
        const dy = y - t.y;
        const dx = x - t.x;
        if (Math.abs(dy) < HANDOFF_PX || Math.abs(dy) <= Math.abs(dx)) return;
        if (dy < 0 && snapRef.current === "rail" && !inSearchRef.current) {
          startDrag(y);
          setDragging(true);
        } else {
          touchRef.current = null;
          return;
        }
      }
      e.preventDefault();
      moveDrag(y);
    };
    const onTouchEnd = () => {
      if (dragRef.current) endDrag();
      touchRef.current = null;
    };
    strip.addEventListener("touchstart", onTouchStart, { passive: true });
    strip.addEventListener("touchmove", onTouchMove, { passive: false });
    strip.addEventListener("touchend", onTouchEnd);
    strip.addEventListener("touchcancel", onTouchEnd);
    return () => {
      strip.removeEventListener("touchstart", onTouchStart);
      strip.removeEventListener("touchmove", onTouchMove);
      strip.removeEventListener("touchend", onTouchEnd);
      strip.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, inSearch]);

  const openHeight = dragging ? undefined : snap === "rail" ? heights.rail : heights.full;

  return (
    <section
      ref={rootRef}
      role="region"
      aria-labelledby={titleId}
      // z-30 sopra gli overlay della mappa: pin, tile e attribuzione restano
      // sotto. "Lista campi", banner "Nessun campo" e zoom stanno sopra il
      // bordo via `--sheet-lift` (globals.css); a piena i primi due si
      // nascondono come il FAB (regola in home-ricerca.md §Fuori lane).
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col"
      style={{
        height: openHeight,
        bottom,
        touchAction: "manipulation",
        transition: dragging
          ? "none"
          : reducedMotion
            ? "height 0.01ms"
            : "height 250ms ease",
      }}
      onClickCapture={(e) => {
        // Un drag non deve diventare un tap su card o pin.
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {!inSearch && (
        <button
          ref={handleRef}
          type="button"
          aria-expanded={snap === "full"}
          aria-label={
            snap === "rail"
              ? "Partite vicine. Mostra l'elenco completo"
              : "Partite vicine. Riduci a striscia"
          }
          className="flex min-h-[44px] w-full items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* capture non disponibile: il drag resta attivo */
            }
            startDrag(e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragRef.current) moveDrag(e.clientY);
          }}
          onPointerUp={() => {
            if (!dragRef.current) return;
            if (!dragRef.current.moved) {
              dragRef.current = null;
              setDragging(false);
              reportMetrics(heightsRef.current.rail, false, kbOpen);
              return;
            }
            endDrag();
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragging(false);
            const root = rootRef.current;
            if (root) root.style.height = "";
            clearStripInline();
          }}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            cycle();
          }}
          onKeyDown={(e) => {
            // Enter e Spazio espliciti: il preventDefault disattiva
            // l'attivazione nativa del bottone (niente doppio ciclo con
            // onClick, che resta per mouse, touch e lettori di schermo
            // che sintetizzano il click senza tasti).
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cycle();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              onSnapChangeRef.current("full");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onSnapChangeRef.current("rail");
            } else if (e.key === "Escape" || e.key === "Home") {
              e.preventDefault();
              onSnapChangeRef.current("rail");
            } else if (e.key === "End") {
              e.preventDefault();
              onSnapChangeRef.current("full");
            }
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-[var(--text-muted)]/40" aria-hidden="true" />
        </button>
      )}
      {/* Guscio visivo sotto l'handle: radius + overflow taglierebbero gli
          angoli del bottone (axe target-size). L'handle resta fuori dal clip. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-sheet border-t border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-lg">
      <div ref={headRef} className="px-4 pt-1">
        <div className="flex items-center gap-2">
          <h2
            id={titleId}
            className="font-[family-name:var(--font-syne)] text-xl font-bold text-[var(--text-primary)]"
          >
            {title}
          </h2>
          {count !== null && (
            <span
              aria-hidden="true"
              className="rounded-chip bg-[var(--accent-subtle)] px-2 py-0.5 text-label font-semibold text-[var(--text-primary)]"
            >
              {count}
            </span>
          )}
          {actions && <span className="ms-auto flex items-center gap-2">{actions}</span>}
        </div>
        {meta !== null && snap === "full" && !(inSearch && kbOpen) && (
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{meta}</p>
        )}
      </div>
      <div
        ref={stripOuterRef}
        inert={stripHidden}
        aria-hidden={stripHidden}
        style={stripHidden ? { display: "none" } : undefined}
      >
        <div
          ref={stripInnerRef}
          className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2"
          style={{ touchAction: "pan-x", scrollSnapType: "x mandatory" }}
        >
          {rail}
        </div>
      </div>
      <div
        ref={listRef}
        inert={listHidden}
        aria-hidden={listHidden}
        style={listHidden ? { display: "none" } : undefined}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6"
        role="presentation"
      >
        {children}
      </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
