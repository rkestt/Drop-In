"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { courtPhotoPublicUrl } from "@/lib/storage/court-photos";
import { cn } from "@/lib/utils";

/**
 * Miniatura quadrata della foto campo per righe lista e card lobby.
 *
 * - `photo_path` assente o immagine non caricabile → placeholder a token nello
 *   stesso box: mai icona di immagine rotta e nessun layout shift (il box è
 *   riservato dal chiamante con `className`, es. `h-14 w-14`).
 * - Decorativa (`alt=""`, wrapper `aria-hidden`): il nome del campo è già nel
 *   testo e nel nome accessibile del link che la contiene.
 */
export function CourtPhotoThumb({
  photoPath,
  className,
}: {
  photoPath: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = courtPhotoPublicUrl(photoPath);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "block shrink-0 overflow-hidden rounded-control border border-[var(--border)] bg-[var(--bg-elevated)]",
        className
      )}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Camera className="h-5 w-5 text-[var(--text-muted)]" />
        </span>
      )}
    </span>
  );
}
