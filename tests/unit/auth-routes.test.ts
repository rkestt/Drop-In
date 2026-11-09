import { describe, expect, it } from "vitest";
import {
  isProtectedPath,
  loginRedirectUrl,
  resolveLoginDestination,
  safeNext,
} from "@/lib/auth/routes";

describe("safeNext", () => {
  it("returns / for missing or empty values", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("   ")).toBe("/");
  });

  it("keeps valid relative paths", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("/profile/settings")).toBe("/profile/settings");
    expect(safeNext("/courts/abc-123")).toBe("/courts/abc-123");
    expect(safeNext("/~offline")).toBe("/~offline");
  });

  it("keeps query string and hash", () => {
    expect(safeNext("/lobbies?tab=nearby")).toBe("/lobbies?tab=nearby");
    expect(safeNext("/lobbies?tab=mine#list")).toBe("/lobbies?tab=mine#list");
    expect(safeNext("/profile#section")).toBe("/profile#section");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("//evil.com/profile")).toBe("/");
  });

  it("rejects backslash escapes", () => {
    expect(safeNext("/\\evil")).toBe("/");
    expect(safeNext("/profile\\x")).toBe("/");
  });

  it("rejects absolute URLs and dangerous schemes", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com/x")).toBe("/");
    expect(safeNext("HTTPS://evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("data:text/html,hi")).toBe("/");
  });

  it("rejects paths without a leading slash", () => {
    expect(safeNext("profile")).toBe("/");
    expect(safeNext("evil.com/profile")).toBe("/");
  });

  it("rejects raw whitespace inside the value", () => {
    expect(safeNext("/pro file")).toBe("/");
    expect(safeNext("/lob\tbies")).toBe("/");
  });

  it("rejects encoded leading slashes and backslash tricks", () => {
    // "%2F%2Fevil.com" starts with "%", not "/", so it is not same-origin.
    expect(safeNext("%2F%2Fevil.com")).toBe("/");
    expect(safeNext("%2f%2fevil.com")).toBe("/");
  });

  it("lets encoded chars inside a same-origin path through untouched", () => {
    // "/%5cevil" contains no literal backslash; decoding (if any) happens
    // downstream in the framework/router, safeNext does not decode.
    expect(safeNext("/%5cevil")).toBe("/%5cevil");
  });

  it("rejects control characters", () => {
    expect(safeNext("/foo\nbar")).toBe("/");
    expect(safeNext("/foo\rbar")).toBe("/");
    expect(safeNext("/foo\tbar")).toBe("/");
  });

  it("allows colons and dot-segments inside a same-origin path", () => {
    // A colon after the leading "/" is a legal path character, not a
    // scheme (schemes only count at the start, which here is "/").
    expect(safeNext("/foo:bar")).toBe("/foo:bar");
    // "/../x" stays same-origin; dot-segment normalization is the
    // server/framework's job, not the sanitizer's.
    expect(safeNext("/../x")).toBe("/../x");
  });

  it("trims surrounding whitespace around a valid path", () => {
    expect(safeNext("  /profile  ")).toBe("/profile");
  });
});

describe("isProtectedPath", () => {
  it("protects /profile and its subpaths", () => {
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/profile/")).toBe(true);
    expect(isProtectedPath("/profile/settings")).toBe(true);
  });

  it("does not protect /profiles lookalikes", () => {
    expect(isProtectedPath("/profiles")).toBe(false);
    expect(isProtectedPath("/profiles/abc")).toBe(false);
  });

  it("protects /lobbies and its subpaths", () => {
    expect(isProtectedPath("/lobbies")).toBe(true);
    expect(isProtectedPath("/lobbies/abc")).toBe(true);
  });

  it("does not protect /lobbying lookalikes", () => {
    expect(isProtectedPath("/lobbying")).toBe(false);
    expect(isProtectedPath("/lobbying/x")).toBe(false);
  });

  it("keeps protecting /dashboard subpaths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/x")).toBe(true);
  });

  it("leaves public routes alone", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("")).toBe(false);
    expect(isProtectedPath(null)).toBe(false);
    expect(isProtectedPath("/courts/abc-123")).toBe(false);
    expect(isProtectedPath("/~offline")).toBe(false);
    expect(isProtectedPath("/submit-court")).toBe(false);
  });

  it("is case-sensitive and segment-exact on edge inputs", () => {
    expect(isProtectedPath("/PROFILE")).toBe(false);
    expect(isProtectedPath("/dashboard/")).toBe(true);
    // "//profile" splits to ["", "", "profile"]: first segment is empty.
    expect(isProtectedPath("//profile")).toBe(false);
  });

  it("ignores query string and hash when matching", () => {
    expect(isProtectedPath("/profile?x=1")).toBe(true);
    expect(isProtectedPath("/lobbies?tab=mine")).toBe(true);
    expect(isProtectedPath("/profiles?x=1")).toBe(false);
  });
});

describe("loginRedirectUrl", () => {
  it("preserves path + query in next", () => {
    expect(loginRedirectUrl("/lobbies", "?tab=mine")).toBe(
      "/?login=required&next=%2Flobbies%3Ftab%3Dmine"
    );
  });

  it("accepts search with or without the leading ?", () => {
    expect(loginRedirectUrl("/lobbies", "tab=mine")).toBe(
      "/?login=required&next=%2Flobbies%3Ftab%3Dmine"
    );
  });

  it("works without a query string", () => {
    expect(loginRedirectUrl("/profile", "")).toBe(
      "/?login=required&next=%2Fprofile"
    );
  });

  it("keeps the nearby tab destination intact", () => {
    const url = loginRedirectUrl("/lobbies", "?tab=nearby");
    expect(url).toBe("/?login=required&next=%2Flobbies%3Ftab%3Dnearby");
    // round-trip: the encoded next decodes back to the original destination
    const next = new URL(url, "http://localhost").searchParams.get("next");
    expect(next).toBe("/lobbies?tab=nearby");
    expect(safeNext(next)).toBe("/lobbies?tab=nearby");
  });

  it("drops the fragment by design", () => {
    // Browsers never send the fragment to the server, so the middleware
    // builds this from pathname + search only. If a "#" ever sneaks into
    // the input, it is cut rather than propagated.
    expect(loginRedirectUrl("/lobbies", "?tab=mine#list")).toBe(
      "/?login=required&next=%2Flobbies%3Ftab%3Dmine"
    );
  });
});

describe("resolveLoginDestination", () => {
  it("returns undefined when no next was provided (stay on page)", () => {
    expect(resolveLoginDestination(undefined)).toBeUndefined();
    expect(resolveLoginDestination(null)).toBeUndefined();
  });

  it("sanitizes an explicit next", () => {
    expect(resolveLoginDestination("/profile")).toBe("/profile");
    expect(resolveLoginDestination("/lobbies?tab=nearby")).toBe(
      "/lobbies?tab=nearby"
    );
    expect(resolveLoginDestination("//evil.com")).toBe("/");
    expect(resolveLoginDestination("https://evil.com")).toBe("/");
  });
});
