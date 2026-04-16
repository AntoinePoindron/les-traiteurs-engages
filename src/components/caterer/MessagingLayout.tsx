"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Send, Paperclip, ChevronLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database";
import type { PartnerProfile } from "@/app/(dashboard)/caterer/messages/page";

// ── Types ─────────────────────────────────────────────────────

type ThreadSummary = {
  thread_id: string;
  partner_id: string;
  partner_name: string;
  company_name: string;
  last_message_body: string;
  last_message_at: string;
  unread_count: number;
  quote_request_id: string | null;
  order_id: string | null;
};

// ── Helpers ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#1A3A52", "#16A34A", "#D97706", "#7C3AED", "#DB2777", "#0284C7",
];
function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Aujourd'hui - ${time}`;
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (daysDiff < 2) return `Hier - ${time}`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });
}

function buildThreads(
  messages: Message[],
  profileMap: Map<string, PartnerProfile>,
  myUserId: string
): ThreadSummary[] {
  const threadData = new Map<
    string,
    {
      lastMsg: Message;
      unread: number;
      partner_id: string;
      quote_request_id: string | null;
      order_id: string | null;
    }
  >();

  // messages are DESC — first occurrence per thread = latest
  for (const msg of messages) {
    const partnerId =
      msg.sender_id === myUserId ? msg.recipient_id : msg.sender_id;
    if (!threadData.has(msg.thread_id)) {
      threadData.set(msg.thread_id, {
        lastMsg: msg,
        unread: 0,
        partner_id: partnerId,
        quote_request_id: msg.quote_request_id,
        order_id: msg.order_id,
      });
    }
    if (!msg.is_read && msg.recipient_id === myUserId) {
      threadData.get(msg.thread_id)!.unread++;
    }
  }

  return Array.from(threadData.entries())
    .sort(
      (a, b) =>
        new Date(b[1].lastMsg.created_at).getTime() -
        new Date(a[1].lastMsg.created_at).getTime()
    )
    .map(([thread_id, data]) => {
      const profile = profileMap.get(data.partner_id);
      const partner_name = profile
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
          "Inconnu"
        : "Inconnu";
      return {
        thread_id,
        partner_id: data.partner_id,
        partner_name,
        company_name: profile?.companies?.name ?? profile?.caterers?.name ?? "—",
        last_message_body: data.lastMsg.body,
        last_message_at: data.lastMsg.created_at,
        unread_count: data.unread,
        quote_request_id: data.quote_request_id,
        order_id: data.order_id,
      };
    });
}

// ── Sub-components ────────────────────────────────────────────

function InitialsAvatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  const bg = avatarColor(name);
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.4,
        fontFamily: "Marianne, system-ui, sans-serif",
      }}
    >
      {initial}
    </div>
  );
}

function ThreadItem({
  thread,
  isActive,
  onClick,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 items-start px-5 py-4 text-left transition-colors border-b border-[#F2F2F2] last:border-0"
      style={{ backgroundColor: isActive ? "#F0F7FF" : "transparent" }}
    >
      <InitialsAvatar name={thread.company_name} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className="text-sm font-bold text-black truncate"
            style={{
              fontFamily: "Marianne, system-ui, sans-serif",
              fontVariationSettings: "'SOFT' 0, 'WONK' 1",
            }}
          >
            {thread.company_name}
          </p>
          {thread.unread_count > 0 && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: "#FF5455" }}
            />
          )}
        </div>
        <p
          className="text-[10px] mb-1"
          style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
        >
          {formatTime(thread.last_message_at)}
        </p>
        <p
          className="text-xs text-black line-clamp-2"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {thread.last_message_body}
        </p>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  isFromMe,
  partnerName,
}: {
  message: Message;
  isFromMe: boolean;
  partnerName: string;
}) {
  if (isFromMe) {
    return (
      <div className="flex gap-2 items-end justify-end">
        <div
          className="max-w-[70%] flex flex-col gap-1.5 p-4 rounded-xl text-white"
          style={{ backgroundColor: "#1A3A52" }}
        >
          <p
            className="text-sm"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {message.body}
          </p>
          <p
            className="text-[10px] opacity-70 text-right"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-end">
      <InitialsAvatar name={partnerName} size={28} />
      <div
        className="max-w-[70%] flex flex-col gap-1.5 p-4 rounded-xl border border-[#F2F2F2]"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <p
          className="text-sm text-black"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {message.body}
        </p>
        <p
          className="text-[10px]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface MessagingLayoutProps {
  initialMessages: Message[];
  partnerProfiles: PartnerProfile[];
  myUserId: string;
  myName: string;
  initialThreadId?: string | null;
}

export default function MessagingLayout({
  initialMessages,
  partnerProfiles,
  myUserId,
  initialThreadId,
}: MessagingLayoutProps) {
  const supabase = useRef(createClient());
  const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId ?? null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversation" | "attachments">(
    "conversation"
  );
  const [mobileView, setMobileView] = useState<"list" | "conversation">(
    initialThreadId ? "conversation" : "list"
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build profile map
  const profileMap = useMemo(
    () => new Map(partnerProfiles.map((p) => [p.id, p])),
    [partnerProfiles]
  );

  // Derived thread list
  const threads = useMemo(
    () => buildThreads(allMessages, profileMap, myUserId),
    [allMessages, profileMap, myUserId]
  );

  const selectedThread = threads.find((t) => t.thread_id === selectedThreadId);

  // Messages for the active thread, chronological
  const activeMessages = useMemo(
    () =>
      allMessages
        .filter((m) => m.thread_id === selectedThreadId)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [allMessages, selectedThreadId]
  );

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  // Mark initial thread as read on mount
  useEffect(() => {
    if (initialThreadId) markThreadRead(initialThreadId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.current
      .channel("incoming-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${myUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setAllMessages((prev) => [newMsg, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.current.removeChannel(channel);
    };
  }, [myUserId]);

  // Mark thread as read on open
  const markThreadRead = useCallback(
    async (threadId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.current as any)
        .from("messages")
        .update({ is_read: true })
        .eq("thread_id", threadId)
        .eq("recipient_id", myUserId)
        .eq("is_read", false);

      setAllMessages((prev) =>
        prev.map((m) =>
          m.thread_id === threadId && m.recipient_id === myUserId
            ? { ...m, is_read: true }
            : m
        )
      );
    },
    [myUserId]
  );

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setActiveTab("conversation");
    setMobileView("conversation");
    markThreadRead(threadId);
  }

  async function handleSendMessage() {
    if (!messageInput.trim() || !selectedThread || sending) return;
    const body = messageInput.trim();
    setMessageInput("");
    setSending(true);

    // Optimistic insert
    const optimistic: Message = {
      id: crypto.randomUUID(),
      thread_id: selectedThread.thread_id,
      sender_id: myUserId,
      recipient_id: selectedThread.partner_id,
      quote_request_id: selectedThread.quote_request_id,
      order_id: selectedThread.order_id,
      body,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setAllMessages((prev) => [optimistic, ...prev]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.current as any).from("messages").insert({
      thread_id: selectedThread.thread_id,
      sender_id: myUserId,
      recipient_id: selectedThread.partner_id,
      quote_request_id: selectedThread.quote_request_id,
      order_id: selectedThread.order_id,
      body,
      is_read: false,
    });

    if (error) {
      // Revert optimistic
      setAllMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessageInput(body);
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  const threadCount = threads.length;

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-4 md:px-6 pb-12">
        <div className="mx-auto" style={{ maxWidth: "1020px" }}>

          <h1
            className="font-display font-bold text-4xl mb-6 text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Messagerie
          </h1>

          <div className="flex gap-6 items-start">

            {/* ── Conversation list ── */}
            <div
              className={`bg-white rounded-lg flex flex-col overflow-hidden shrink-0 w-full md:w-[288px] ${
                mobileView === "conversation" ? "hidden md:flex" : "flex"
              }`}
              style={{ maxHeight: "calc(100vh - 160px)", minHeight: 520 }}
            >
              <ConversationListInner
                threads={threads}
                threadCount={threadCount}
                selectedThreadId={selectedThreadId}
                onSelect={handleSelectThread}
              />
            </div>

            {/* ── Conversation panel ── */}
            <div
              className={`flex-1 min-w-0 ${
                mobileView === "list" ? "hidden md:block" : "block"
              }`}
            >
              {selectedThread ? (
                <div
                  className="bg-white rounded-lg flex flex-col"
                  style={{ height: "calc(100vh - 160px)", minHeight: 520 }}
                >
                  {/* Header */}
                  <div className="flex flex-col gap-4 p-6 shrink-0">
                    <div className="flex items-center gap-3">
                      {/* Back on mobile */}
                      <button
                        className="md:hidden p-1 text-navy"
                        onClick={() => setMobileView("list")}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <InitialsAvatar name={selectedThread.company_name} size={56} />
                      <div className="flex flex-col gap-0.5">
                        <p
                          className="font-display font-bold text-xl text-black leading-tight"
                          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                        >
                          {selectedThread.company_name}
                        </p>
                        <p
                          className="text-sm text-black"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {selectedThread.partner_name}
                        </p>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-5 border-b border-[#F2F2F2]">
                      {(
                        [
                          { key: "conversation", label: "Conversation" },
                          { key: "attachments", label: "Pièces jointes" },
                        ] as const
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setActiveTab(key)}
                          className="pb-2 text-xs font-bold transition-colors"
                          style={{
                            fontFamily: "Marianne, system-ui, sans-serif",
                            color: activeTab === key ? "#1A3A52" : "#A2A2A2",
                            borderBottom:
                              activeTab === key
                                ? "2px solid #1A3A52"
                                : "2px solid transparent",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-3">
                    {activeTab === "conversation" ? (
                      activeMessages.length === 0 ? (
                        <p
                          className="text-sm text-center py-8"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
                        >
                          Aucun message pour l&apos;instant.
                        </p>
                      ) : (
                        activeMessages.map((msg) => (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isFromMe={msg.sender_id === myUserId}
                            partnerName={selectedThread.company_name}
                          />
                        ))
                      )
                    ) : (
                      <p
                        className="text-sm text-center py-8"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
                      >
                        Aucune pièce jointe dans cette conversation.
                      </p>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input bar */}
                  <div className="px-6 pb-6 pt-3 shrink-0 border-t border-[#F2F2F2]">
                    <div className="flex items-end gap-3">
                      {/* Textarea + attachment */}
                      <div className="flex-1 flex items-end border border-black rounded-lg overflow-hidden">
                        <button
                          type="button"
                          className="p-3 text-[#9CA3AF] hover:text-navy transition-colors shrink-0"
                          title="Pièce jointe (bientôt disponible)"
                        >
                          <Paperclip size={16} />
                        </button>
                        <textarea
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Votre message… (Entrée pour envoyer)"
                          rows={1}
                          className="flex-1 px-2 py-3 text-sm outline-none bg-transparent resize-none"
                          style={{
                            fontFamily: "Marianne, system-ui, sans-serif",
                            color: "#1A1A1A",
                            maxHeight: 120,
                          }}
                          onInput={(e) => {
                            const el = e.target as HTMLTextAreaElement;
                            el.style.height = "auto";
                            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                          }}
                        />
                      </div>

                      {/* Send button */}
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || sending}
                        className="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white transition-colors disabled:opacity-40"
                        style={{
                          backgroundColor: "#1A3A52",
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        <Send size={15} />
                        <span className="hidden sm:inline">Envoyer</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Empty state
                <div
                  className="bg-white rounded-lg flex flex-col items-center justify-center gap-3"
                  style={{ height: "calc(100vh - 160px)", minHeight: 520 }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#F5F1E8" }}
                  >
                    <MessageSquare size={24} className="text-navy" />
                  </div>
                  <p
                    className="font-display font-bold text-lg text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Sélectionnez une conversation
                  </p>
                  <p
                    className="text-sm"
                    style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
                  >
                    Choisissez une conversation dans la liste pour l&apos;afficher.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

// ── Conversation list inner ───────────────────────────────────

function ConversationListInner({
  threads,
  threadCount,
  selectedThreadId,
  onSelect,
}: {
  threads: ThreadSummary[];
  threadCount: number;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="px-5 py-4 border-b border-[#F2F2F2] shrink-0">
        <p
          className="text-xs font-bold text-black"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {threadCount} conversation{threadCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="overflow-y-auto flex-1">
        {threads.length === 0 ? (
          <p
            className="text-sm text-center py-10 px-5"
            style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#A2A2A2" }}
          >
            Aucune conversation pour l&apos;instant.
          </p>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.thread_id}
              thread={thread}
              isActive={thread.thread_id === selectedThreadId}
              onClick={() => onSelect(thread.thread_id)}
            />
          ))
        )}
      </div>
    </>
  );
}
