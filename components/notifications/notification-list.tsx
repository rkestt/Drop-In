"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  notificationHref,
  type NotificationRow,
} from "@/lib/notifications/link";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

interface NotificationListProps {
  initialItems: NotificationRow[];
  initialHasMore: boolean;
  initialError: boolean;
  userId: string;
}

function minutesAgoLabel(lastSync: number): string {
  const mins = Math.max(1, Math.round((Date.now() - lastSync) / 60_000));
  return `Dati di ${mins} min fa`;
}

export function NotificationList({
  initialItems,
  initialHasMore,
  initialError,
  userId,
}: NotificationListProps) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  // `navigator` esiste anche sul server (stub Node >= 21 senza `onLine`):
  // primo render sempre online come il server, valore reale nell'effect.
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seenIds = useRef(new Set(initialItems.map((item) => item.id)));

  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine);
      setLastSync(Date.now());
    };
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Realtime: nuova riga per l'utente → prepend + un solo toast per id.
  useEffect(() => {
    const channel = supabase
      .channel(`push-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "push_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setItems((prev) =>
            prev.some((item) => item.id === row.id)
              ? prev
              : [{ ...row }, ...prev]
          );
          setLastSync(Date.now());
          setNewIds((prev) => new Set(prev).add(row.id));
          window.setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
          }, 2000);
          toast(row.title, { id: row.id, description: row.body });
          setAnnouncement(`Nuova notifica: ${row.title}. ${row.body}`);
          window.dispatchEvent(new CustomEvent("notifications:changed"));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("push_notifications")
      .select("id,title,body,data,sent_at,read_at")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .range(items.length, items.length + PAGE_SIZE - 1);
    if (error) {
      setLoadError(true);
    } else {
      // Il prepend realtime sposta l'offset: filtra le righe già viste
      // per non duplicarle in lista.
      const rows = ((data ?? []) as NotificationRow[]).filter(
        (row) => !seenIds.current.has(row.id)
      );
      for (const row of rows) seenIds.current.add(row.id);
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      setLastSync(Date.now());
    }
    setLoadingMore(false);
  }, [supabase, userId, items.length]);

  // Tap: optimistic `read_at` con rollback su errore, poi naviga se
  // `notificationHref` dà un href valido; altrimenti resta sulla pagina.
  const handleOpen = useCallback(
    async (notification: NotificationRow) => {
      const href = notificationHref(notification.data);
      const markedAt = new Date().toISOString();
      if (notification.read_at === null) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, read_at: markedAt } : item
          )
        );
        const { error } = await supabase
          .from("push_notifications")
          .update({ read_at: markedAt })
          .eq("id", notification.id)
          .eq("user_id", userId);
        if (error) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === notification.id ? { ...item, read_at: null } : item
            )
          );
          toast.error("Non riusciamo a segnare la notifica come letta.", {
            description: "Controlla la connessione e riprova.",
          });
          return;
        }
        window.dispatchEvent(new CustomEvent("notifications:changed"));
      }
      if (href) router.push(href);
    },
    [router, supabase, userId]
  );

  const handleMarkAll = useCallback(async () => {
    const unreadIds = items
      .filter((item) => item.read_at === null)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    const previous = items;
    const markedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) =>
        item.read_at === null ? { ...item, read_at: markedAt } : item
      )
    );
    const { error } = await supabase
      .from("push_notifications")
      .update({ read_at: markedAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      setItems(previous);
      toast.error("Non riusciamo a segnare le notifiche come lette.", {
        description: "Controlla la connessione e riprova.",
      });
    } else {
      setAnnouncement("Tutte le notifiche sono state segnate come lette.");
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    }
    setMarkingAll(false);
  }, [items, supabase, userId]);

  if (initialError && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 w-full max-w-[300px] mx-auto text-center px-5 py-6">
        <p className="text-xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
          Non riusciamo a caricare le notifiche.
        </p>
        <p className="text-sm text-[var(--text-secondary)] max-w-[260px]">
          Controlla la connessione e riprova.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-2 w-full min-h-[44px]"
          onClick={() => window.location.reload()}
        >
          Riprova
        </Button>
        <p className="sr-only" role="status">
          Caricamento notifiche non riuscito.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 w-full max-w-[300px] mx-auto text-center px-5 py-6">
        <span
          aria-hidden="true"
          className="grid place-items-center w-14 h-14 rounded-card bg-[var(--bg-surface)] text-[var(--text-muted)]"
        >
          <Bell className="w-6 h-6" />
        </span>
        <p className="text-xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
          Nessuna notifica
        </p>
        <p className="text-sm text-[var(--text-secondary)] max-w-[260px]">
          Ti avvisiamo qui quando cambia qualcosa.
        </p>
        <Link
          href="/profile"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-control-sm text-sm font-semibold min-h-[44px] mt-2 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--cool-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Vai al profilo
        </Link>
      </div>
    );
  }

  const unreadCount = items.filter((item) => item.read_at === null).length;

  return (
    <div>
      {!online && (
        <div className="px-4 pt-3">
          <div
            role="status"
            className="flex items-start gap-2.5 p-3 rounded-card bg-[var(--warning)]/10 border border-[var(--warning)]/30"
          >
            <WifiOff
              aria-hidden="true"
              className="w-5 h-5 mt-0.5 shrink-0 text-[var(--warning-dark)]"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {minutesAgoLabel(lastSync)}
              </p>
              <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
                Sei offline. Segnare come letta richiede la connessione.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 min-h-[52px] px-4 py-2 border-b border-[var(--cool-muted)]/20">
        {unreadCount > 0 ? (
          <Badge variant="accent">
            {unreadCount} {unreadCount === 1 ? "non letta" : "non lette"}
          </Badge>
        ) : (
          <Badge variant="default">Tutte lette</Badge>
        )}
        {online && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={markingAll}
            className="min-h-[44px] px-1 text-sm font-semibold text-[var(--accent)] hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-control-sm disabled:opacity-50"
          >
            {markingAll ? "Segno come lette…" : "Segna tutte come lette"}
          </button>
        )}
      </div>

      <ul
        aria-label="Notifiche"
        className="bg-[var(--bg-surface)] border-b border-[var(--cool-muted)]/20 divide-y divide-[var(--cool-muted)]/20"
      >
        {items.map((item) => (
          <NotificationItem
            key={item.id}
            notification={item}
            href={notificationHref(item.data)}
            interactive={online}
            isNew={newIds.has(item.id)}
            onOpen={handleOpen}
          />
        ))}
      </ul>

      {hasMore && (
        <div className="flex flex-col items-center gap-2 px-4 py-4">
          {loadError && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              Non riusciamo a caricare altre notifiche.
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={loadingMore || !online}
            onClick={loadMore}
          >
            {loadingMore ? "Caricamento…" : loadError ? "Riprova" : "Carica altre"}
          </Button>
        </div>
      )}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
