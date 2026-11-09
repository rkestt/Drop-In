import { describe, expect, it } from "vitest";
import { isProtectedPath, loginRedirectUrl, safeNext } from "@/lib/auth/routes";

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
    expect(isProtectedPath("/courts/abc-123")).toBe(false);
    expect(isProtectedPath("/~offline")).toBe(false);
    expect(isProtectedPath("/submit-court")).toBe(false);
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
});
