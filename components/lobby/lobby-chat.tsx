"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LobbyChatProps {
  lobbyId: string;
  userId: string;
  maxHeight?: number;
}

interface Message {
  id: string;
  lobby_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    nickname: string | null;
    avatar_url: string | null;
  };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "ora";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "ieri";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function LobbyChat({ lobbyId, userId, maxHeight = 360 }: LobbyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("lobby_messages")
        .select("*, profiles(nickname, avatar_url)")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: true })
        .limit(100);

      setMessages((data ?? []) as Message[]);
      setLoading(false);

      // Scroll to bottom on initial load
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    };

    loadMessages();
  }, [lobbyId, supabase]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`lobby-chat-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lobby_messages",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        async (payload) => {
          // Fetch the full message with profile
          const { data } = await supabase
            .from("lobby_messages")
            .select("*, profiles(nickname, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data as Message]);

            // Track unread if user is not at bottom
            if (!isAtBottom) {
              setUnreadCount((c) => c + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId, supabase, isAtBottom]);

  // Auto-scroll on new messages when at bottom
  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages, isAtBottom]);

  // Detect scroll position
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    try {
      const { error: insertError } = await supabase.from("lobby_messages").insert({
        lobby_id: lobbyId,
        user_id: userId,
        content: text,
      } as any);

      if (insertError) throw insertError;

      // Focus back on input
      inputRef.current?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nell'invio.";
      setError(msg);
      setInput(text); // restore input
    } finally {
      setSending(false);
    }
  };

  // Group messages by sender for consecutive messages
  const groupedMessages: Array<{ message: Message; isGroupStart: boolean }> = [];
  let lastSenderId = "";
  for (const msg of messages) {
    const isGroupStart = msg.user_id !== lastSenderId;
    if (isGroupStart) lastSenderId = msg.user_id;
    groupedMessages.push({ message: msg, isGroupStart });
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
    setIsAtBottom(true);
  };

  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)] rounded-2xl border border-[var(--cool-muted)]/15 flex flex-col transition-all duration-300",
        isCollapsed ? "h-[56px]" : "h-auto"
      )}
      style={{ maxHeight: isCollapsed ? 56 : maxHeight + 56 }}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed((c) => !c)}
        className="flex items-center justify-between px-4 py-3 w-full text-left hover:bg-[var(--bg-elevated)]/50 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
            Chat della partita
          </span>
          {messages.length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {messages.length} messaggio{messages.length !== 1 ? "i" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-medium bg-[var(--accent)] text-white rounded-full px-2 py-0.5">
              {unreadCount} nuovo{unreadCount !== 1 ? "i" : ""}
            </span>
          )}
          {isCollapsed ? (
            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </div>
      </button>

      {/* Chat body */}
      {!isCollapsed && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages list */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 space-y-1"
            style={{ maxHeight: maxHeight - 56 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-pulse text-sm text-[var(--text-muted)]">
                  Caricamento messaggi...
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <MessageCircle className="w-8 h-8 text-[var(--text-muted)]/30" />
                <p className="text-sm text-[var(--text-muted)]">
                  Nessun messaggio ancora.
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Dì qualcosa ai tuoi compagni di partita!
                </p>
              </div>
            ) : (
              <>
                {groupedMessages.map(({ message: msg, isGroupStart }) => {
                  const isMine = msg.user_id === userId;
                  const initials = msg.profiles?.nickname?.[0]?.toUpperCase() ?? "?";

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-2",
                        isMine && "flex-row-reverse"
                      )}
                    >
                      {/* Avatar */}
                      {isGroupStart ? (
                        <div className="flex-shrink-0">
                          {msg.profiles?.avatar_url ? (
                            <img
                              src={msg.profiles.avatar_url}
                              alt={msg.profiles.nickname ?? "?"}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                              <span className="text-xs font-bold text-[var(--accent)]">
                                {initials}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Spacer to align with first message */
                        <div className="w-8 flex-shrink-0" />
                      )}

                      {/* Content */}
                      <div
                        className={cn(
                          "flex flex-col",
                          isMine ? "items-end" : "items-start",
                          isGroupStart ? "mb-0" : "mt-0"
                        )}
                      >
                        {isGroupStart && (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">
                              {isMine ? "Tu" : msg.profiles?.nickname ?? "Giocatore"}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "px-3 py-1.5 rounded-2xl text-sm max-w-[240px] break-words",
                            isMine
                              ? "bg-[var(--accent)] text-white rounded-br-sm"
                              : "bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-bl-sm"
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Bottom anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Unread indicator */}
          {!isAtBottom && unreadCount === 0 && (
            <div className="flex justify-center py-1">
              <button
                onClick={scrollToBottom}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1"
              >
                <ChevronDown className="w-3 h-3" />
                Ultimi messaggi
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 pb-1">
              <p className="text-xs text-[var(--danger)]">{error}</p>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 px-4 py-3 border-t border-[var(--cool-muted)]/15"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Scrivi un messaggio..."
              rows={1}
              maxLength={500}
              className="flex-1 resize-none bg-[var(--bg-elevated)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--cool-muted)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/40 transition-all max-h-[120px]"
            />
            <Button
              type="submit"
              size="icon"
              variant="primary"
              disabled={!input.trim() || sending}
              className="flex-shrink-0 h-[42px] w-[42px]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}