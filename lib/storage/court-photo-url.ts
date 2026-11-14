/**
 * Foto campo: parte pura e **server-safe** (nessun `"use client"`).
 *
 * Sta fuori da `lib/storage/court-photos.ts` perché quel modulo è un client
 * module (`"use client"`): importarne una funzione da un Server Component (es.
 * `generateMetadata` nelle pagine campo/lobby) produce un client reference e
 * la chiamata esplode a runtime, mentre `tsc` non vede nulla. Stesso schema
 * di `lib/storage/avatar-url.ts` per `avatarPublicUrl`. Qui dentro solo
 * calcolo di URL: nessun accesso a `window`, `crypto` o al client Supabase.
 */
import { supabaseUrl } from "@/lib/supabase/url";

/** Bucket pubblico delle foto campo. */
export const COURT_PHOTOS_BUCKET = "court-photos";

/**
 * URL pubblico di una foto campo da `courts.photo_path`, nello stesso formato
 * di `storage.from(BUCKET_NAME).getPublicUrl(path)` ma senza istanziare un
 * client per ogni card di lista. In dev `supabaseUrl()` risolve il proxy
 * `/supabase`; path assente o base non configurata → null (il chiamante
 * mostra il placeholder, mai un `src` vuoto).
 */
export function courtPhotoPublicUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const base = supabaseUrl().replace(/\/$/, "");
  if (!base) return null;
  // Encode per segmento: spazi, `#`, `?` e simili nel nome file non devono
  // rompere l'URL (né troncarlo al `#`). Il formato resta quello di
  // `getPublicUrl`: base + `/storage/v1/object/public/<bucket>/<path>`.
  const encoded = path
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${base}/storage/v1/object/public/${COURT_PHOTOS_BUCKET}/${encoded}`;
}
