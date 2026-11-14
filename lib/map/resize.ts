import type maplibregl from "maplibre-gl";

/**
 * Tiene la mappa sincronizzata con la dimensione del contenitore.
 *
 * - `window.resize`: il viewport puo' cambiare senza che il contenitore cambi
 *   (es. barra indirizzi mobile).
 * - `ResizeObserver`: pannelli, drawer e rotazioni cambiano il box senza un
 *   resize della finestra. `lastSize` evita `resize()` in loop quando il
 *   contenitore non cambia davvero.
 *
 * Ritorna la cleanup: `court-map.tsx` la chiama dentro `map.on("remove")`.
 */
export function trackMapSize(
  map: maplibregl.Map,
  container: HTMLElement,
  lastSize: { current: { w: number; h: number } | null }
): () => void {
  const resizeHandler = () => map.resize();
  window.addEventListener("resize", resizeHandler);

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (width <= 0 || height <= 0) return;
    const last = lastSize.current;
    if (last && last.w === width && last.h === height) return;
    lastSize.current = { w: width, h: height };
    map.resize();
  });
  resizeObserver.observe(container);

  return () => {
    window.removeEventListener("resize", resizeHandler);
    resizeObserver.disconnect();
  };
}
