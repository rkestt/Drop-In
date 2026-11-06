export function MapSkeleton() {
  return (
    <div
      className="w-full h-full min-h-[50vh] animate-pulse bg-[var(--bg-surface)]"
      role="status"
      aria-label="Caricamento mappa"
    />
  );
}

export default MapSkeleton;
