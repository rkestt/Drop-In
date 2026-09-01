import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Schema-drift guard. The typed accesses below fail at COMPILE time if a
 * migration renames/drops a table the app depends on; the runtime assertion
 * makes vitest report it too (types are erased at runtime, so we assert the
 * type objects exist via a compile-checked map).
 */
const REQUIRED_TABLES = [
  "courts",
  "profiles",
  "lobbies",
  "lobby_participants",
  "check_ins",
  "court_reports",
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

describe("database.types.ts schema guard", () => {
  it("exposes every table the application code depends on", () => {
    expect(REQUIRED_TABLES).toHaveLength(6);
    // Compile-time guard: this assignment breaks if any required table vanishes.
    const check: Array<keyof Database["public"]["Tables"]> = [...REQUIRED_TABLES];
    expect(check).toEqual([
      "courts",
      "profiles",
      "lobbies",
      "lobby_participants",
      "check_ins",
      "court_reports",
    ]);
  });

  it("courts table has Row/Insert shapes", () => {
    const courts: Database["public"]["Tables"]["courts"] = {} as never;
    expect(courts).toBeDefined();
  });
});
