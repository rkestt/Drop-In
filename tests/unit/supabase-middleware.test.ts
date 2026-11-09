import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function locationOf(res: Response): string | null {
  return res.headers.get("location");
}

describe("updateSession fail-open", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("lets public paths through when getUser rejects", async () => {
    mockGetUser.mockRejectedValue(new Error("fetch failed"));
    for (const path of ["/", "/courts/abc-123", "/~offline"]) {
      const res = await updateSession(requestFor(path), { timeoutMs: 5 });
      expect(locationOf(res)).toBeNull();
      expect(res.status).toBe(200);
    }
  });

  it("redirects protected paths to login with next when getUser rejects", async () => {
    mockGetUser.mockRejectedValue(new Error("fetch failed"));

    const profile = await updateSession(requestFor("/profile"), {
      timeoutMs: 5,
    });
    expect(profile.status).toBe(307);
    expect(locationOf(profile)).toBe(
      "http://localhost:3000/?login=required&next=%2Fprofile"
    );

    const lobbies = await updateSession(requestFor("/lobbies?tab=nearby"), {
      timeoutMs: 5,
    });
    expect(lobbies.status).toBe(307);
    expect(locationOf(lobbies)).toBe(
      "http://localhost:3000/?login=required&next=%2Flobbies%3Ftab%3Dnearby"
    );
  });

  it("does not redirect lookalike prefixes on network error", async () => {
    mockGetUser.mockRejectedValue(new Error("fetch failed"));
    for (const path of ["/profiles", "/lobbying"]) {
      const res = await updateSession(requestFor(path), { timeoutMs: 5 });
      expect(locationOf(res)).toBeNull();
    }
  });

  it("treats a hanging getUser as anonymous after the timeout", async () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));
    const res = await updateSession(requestFor("/profile"), {
      timeoutMs: 5,
    });
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe(
      "http://localhost:3000/?login=required&next=%2Fprofile"
    );
  });

  it("does not redirect protected paths when a user is present", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const res = await updateSession(requestFor("/profile"));
    expect(locationOf(res)).toBeNull();
    expect(res.status).toBe(200);
  });

  it("redirects protected paths when the session is empty without error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await updateSession(requestFor("/lobbies"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toBe(
      "http://localhost:3000/?login=required&next=%2Flobbies"
    );
  });
});
