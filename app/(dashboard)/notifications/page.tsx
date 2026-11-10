import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginRedirectUrl } from "@/lib/auth/routes";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationRow } from "@/lib/notifications/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function NotificationsPage() {
  const supabase = await createClient();
  // Fail open come le altre pagine dashboard: senza sessione si torna al
  // login (con next) invece di 500are.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect(loginRedirectUrl("/notifications", ""));
  }

  const { data, error } = await supabase
    .from("push_notifications")
    .select("id,title,body,data,sent_at,read_at")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const items = ((data ?? []) as NotificationRow[]).map((row) => ({
    ...row,
    read_at: row.read_at ?? null,
  }));

  return (
    <main id="contenuto" tabIndex={-1} className="flex-1 w-full max-w-[720px] mx-auto pb-8">
      <h1 className="text-3xl font-bold font-[family-name:var(--font-syne)] px-4 pt-6 pb-4">
        Notifiche
      </h1>
      <NotificationList
        initialItems={items}
        initialHasMore={items.length === PAGE_SIZE}
        initialError={error !== null}
        userId={user.id}
      />
    </main>
  );
}
