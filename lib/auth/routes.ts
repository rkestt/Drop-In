/**
 * Auth route helpers: open-redirect-safe `next` handling and exact
 * protected-path matching (first path segment, no prefix lookalikes).
 */

const PROTECTED_SEGMENTS = new Set(["profile", "lobbies", "dashboard"]);

/**
 * Sanitizes a post-login destination. Only same-origin absolute paths
 * (`/profile`, `/lobbies?tab=mine#list`) pass through; anything else
 * (absolute URLs, protocol-relative URLs, backslash escapes, schemes
 * like `javascript:`, raw whitespace, missing leading slash) falls back
 * to `/`. Query string and hash are preserved.
 */
export function safeNext(value: string | null | undefined): string {
  if (typeof value !== "string") return "/";
  const v = value.trim();
  if (!v.startsWith("/")) return "/";
  if (v.startsWith("//")) return "/";
  if (v.startsWith("/\\")) return "/";
  if (v.includes("\\")) return "/";
  if (/[\s<>]/.test(v)) return "/";
  // Absolute URL or scheme (http:, https:, javascript:, data:, ...),
  // case-insensitive. A same-origin path never contains a scheme.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return "/";
  return v;
}

/**
 * True for protected pages: matches on the first path segment so that
 * `/profile` and `/profile/x` match but `/profiles` does not (same for
 * `/lobbies` vs `/lobbying`). Query string and hash are ignored.
 */
export function isProtectedPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || pathname.length === 0) return false;
  const path = pathname.split(/[?#]/, 1)[0];
  const segments = path.split("/");
  // "/profile/x" -> ["", "profile", "x"]; first segment is segments[1].
  const first = segments[1] ?? "";
  return PROTECTED_SEGMENTS.has(first);
}

/**
 * Builds the login redirect for a protected destination, preserving
 * path + query: `/lobbies?tab=mine` -> `/?login=required&next=...`.
 * `search` may include the leading `?` or not.
 */
export function loginRedirectUrl(pathname: string, search?: string | null): string {
  const q = search ?? "";
  const suffix = q.length === 0 ? "" : q.startsWith("?") ? q : `?${q}`;
  const next = `${pathname}${suffix}`;
  return `/?login=required&next=${encodeURIComponent(next)}`;
}
