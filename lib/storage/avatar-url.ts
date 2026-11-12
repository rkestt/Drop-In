/**
 * Avatar: parte pura e **server-safe** (nessun `"use client"`).
 *
 * Sta fuori da `lib/storage/avatars.ts` perché quel modulo è un client
 * module (`"use client"`): importarne una funzione da un Server Component
 * (`components/profile/profile-header.tsx`) produce un client reference e la
 * chiamata esplode a runtime con "Attempted to call ... from the server".
 * Qui dentro solo calcolo di path/URL e geometria del crop: nessun accesso a
 * `window`, `crypto` o al client Supabase.
 */
import { supabaseUrl } from "@/lib/supabase/url";
import type { CropRect } from "./resize";

/** Bucket degli avatar: primo segmento del path = uid del proprietario. */
export const AVATAR_BUCKET = "avatars";

/** Lato massimo dell'avatar lato client (niente image transforms sul free). */
export const AVATAR_MAX_DIM = 512;

/**
 * Crop quadrato centrato sul lato corto: la regione da cui
 * `resizeSquareImageToJpeg` ricava l'avatar. Puro e testabile.
 */
export function computeAvatarCrop(w: number, h: number): CropRect {
  const size = Math.min(w, h);
  return {
    sx: Math.floor((w - size) / 2),
    sy: Math.floor((h - size) / 2),
    size,
  };
}

const AVATARS_PUBLIC_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

/**
 * `profiles.avatar_url` accetta due forme: il bare path (`<uid>/<uuid>.jpg`,
 * forma canonica dal 028 — il client scrive `uploaded.path`) e l'URL pubblico
 * assoluto delle righe storiche. Restituisce sempre il path oggetto, o null
 * se assente o estraneo al bucket avatars (URL stranieri mai cancellati dal
 * GC né passati allo storage).
 */
export function avatarObjectPath(
  avatarUrl: string | null | undefined
): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.includes("://")) {
    const i = avatarUrl.indexOf(AVATARS_PUBLIC_MARKER);
    if (i === -1) return null;
    const path = avatarUrl.slice(i + AVATARS_PUBLIC_MARKER.length);
    return path ? path : null;
  }
  const path = avatarUrl.replace(/^\/+/, "");
  return path ? path : null;
}

/**
 * URL pubblico dell'avatar da `profiles.avatar_url`, in entrambe le forme
 * accettate da `avatarObjectPath`. Path assente o base non configurata →
 * null (il chiamante mostra le iniziali, mai un `src` vuoto).
 *
 * `supabaseUrl()` è server-safe: in dev risolve il proxy `/supabase`, in
 * produzione l'URL assoluto del progetto.
 */
export function avatarPublicUrl(
  avatarUrl: string | null | undefined
): string | null {
  if (!avatarUrl) return null;
  // Forma storica: URL assoluto già pronto (legacy, le righe nuove usano il
  // bare path).
  if (avatarUrl.includes("://")) return avatarUrl;
  const path = avatarObjectPath(avatarUrl);
  if (!path) return null;
  // Base: si preferisce il valore pubblico così com'è. In dev è relativo
  // (`/supabase`) e resta same-origin anche nell'HTML renderizzato dal
  // server; `supabaseUrl()` invece sul server lo assolutizza in
  // `http://127.0.0.1:54321`, che è corretto per supabase-js ma sbagliato in
  // un `src` servito a un telefono sulla LAN. In produzione è già assoluto.
  const base = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl()
  ).replace(/\/$/, "");
  if (!base) return null;
  const encoded = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${encoded}`;
}
