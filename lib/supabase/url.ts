/**
 * Resolves the Supabase base URL.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` may be relative (e.g. `/supabase`), which keeps
 * the browser on the same origin as the app: the Next dev server proxies the
 * path to the local gateway (see `next.config.js`). That is what lets a phone
 * on the LAN use Supabase over the dev server's https, without mixed content
 * and without hardcoding a LAN IP.
 *
 * In the browser the value is always made absolute, because supabase-js builds
 * request and storage URLs from it. On the server a relative value has no
 * meaning, so it falls back to the local gateway.
 */
export function supabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (!raw.startsWith("/")) return raw;

  if (typeof window !== "undefined") {
    return `${window.location.origin}${raw}`;
  }

  return process.env.SUPABASE_INTERNAL_URL ?? "http://127.0.0.1:54321";
}
