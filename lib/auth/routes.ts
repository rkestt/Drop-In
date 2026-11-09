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
  // Belt-and-braces: unreachable after the leading-slash checks above (a
  // string starting with "/" can never start with a scheme), kept so a
  // future reorder of the checks cannot turn into an open redirect.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return "/";
  return v;
}

/**
 * Resolves the post-login destination for `LoginModal`: `undefined`/`null`
 * (no `next` provided) means "stay on the current page" — the caller must
 * refresh in place instead of navigating. Any provided value is sanitized
 * with `safeNext`, so an explicit `next` is always a safe same-origin path.
 */
export function resolveLoginDestination(
  next: string | null | undefined
): string | undefined {
  if (next === undefined || next === null) return undefined;
  return safeNext(next);
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
 * `search` may include the leading `?` or not. The URL fragment (`#...`)
 * is dropped by design: browsers never send it to the server, so
 * `request.nextUrl.search` — the input this is built from — never has one.
 */
export function loginRedirectUrl(pathname: string, search?: string | null): string {
  const q = search ?? "";
  const withoutFragment = q.split("#", 1)[0];
  const suffix =
    withoutFragment.length === 0
      ? ""
      : withoutFragment.startsWith("?")
        ? withoutFragment
        : `?${withoutFragment}`;
  const next = `${pathname}${suffix}`;
  return `/?login=required&next=${encodeURIComponent(next)}`;
}
