/**
 * Focus trap deterministico per i drawer/sheet.
 *
 * Base UI (modal) già mette i guard sul portal, ma il Tab oltre l'ultimo
 * elemento atterra per un frame su un sentinella fuori dal dialog: il focus
 * visibile sparisce e un lettore di schermo può annunciare il body. Qui il
 * ciclo è esplicito: Tab/Shift+Tab restano sempre dentro il popup, senza
 * dipendere dall'ordine dei sentinella.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/** Elementi raggiungibili da Tab dentro `root`, in ordine DOM. */
export function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Prossimo elemento per Tab/Shift+Tab, con wrap agli estremi.
 * `activeIndex` è -1 quando il focus è fuori dalla lista (o sul popup).
 * Restituisce sempre un elemento (se la lista non è vuota): il chiamante
 * applica `preventDefault()` e sposta il focus, senza lasciare il browser
 * libero di uscire.
 */
export function nextTrapTarget<T>(
  items: readonly T[],
  activeIndex: number,
  shift: boolean
): T | null {
  if (items.length === 0) return null;
  if (activeIndex < 0) {
    return shift ? items[items.length - 1]! : items[0]!;
  }
  if (shift) {
    return items[activeIndex === 0 ? items.length - 1 : activeIndex - 1]!;
  }
  return items[activeIndex >= items.length - 1 ? 0 : activeIndex + 1]!;
}
