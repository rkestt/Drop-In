import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, withSecurityHeaders } from "@/lib/security/headers";

describe("security headers (#84)", () => {
  it("copre gli header anti-sniff, anti-frame e privacy", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("geolocalizzazione solo self, sensori negati", () => {
    const policy = SECURITY_HEADERS["Permissions-Policy"];
    expect(policy).toContain("geolocation=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).not.toContain("geolocation=*");
  });

  it("applica gli header a una risposta senza toccarne gli altri", () => {
    const response = {
      headers: new Headers({ "x-existing": "keep" }),
    };
    const same = withSecurityHeaders(response);
    expect(same).toBe(response);
    expect(response.headers.get("x-existing")).toBe("keep");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("sovrascrive un valore gia' presente invece di duplicarlo", () => {
    const response = {
      headers: new Headers({ "x-frame-options": "SAMEORIGIN" }),
    };
    withSecurityHeaders(response);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
