import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_COOKIE_NAME, supabaseUrl } from "@/lib/supabase/url";

export function createClient() {
  return createBrowserClient<Database>(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { name: SUPABASE_COOKIE_NAME } }
  );
}
