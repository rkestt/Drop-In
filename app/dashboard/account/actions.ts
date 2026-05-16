"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function deleteAccount(userId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Non autorizzato");
  }

  await supabaseAdmin.auth.admin.deleteUser(userId);
  await supabase.auth.signOut();
  redirect("/");
}
