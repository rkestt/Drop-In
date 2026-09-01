import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

/** Unique test user per run to avoid data collisions between specs. */
export async function createTestUser(suffix = ""): Promise<{
  email: string;
  password: string;
  nickname: string;
}> {
  const email = `e2e-${Date.now()}${suffix}@dropin.test`;
  const password = "dropin-e2e-pass";
  const nickname = `e2e_${Date.now()}${suffix}`;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  expect(error).toBeNull();

  return { email, password, nickname };
}

/**
 * Coordinates of a seeded court (Giardino Mary ed Hasib Begum, Rome) —
 * within the 50m check-in radius when mocked as device location.
 */
export const SEEDED_COURT = {
  name: "Giardino Mary ed Hasib Begum",
  lat: 41.89198312222223,
  lng: 12.504052562962963,
};

export const test = base.extend({});
export { expect };
