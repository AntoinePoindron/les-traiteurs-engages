"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, MessageSquare, CheckCircle, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database";

const NOTIF_ICONS: Record<string, React.ElementType> = {
  quote_request_received: Bell,
  quote_accepted: CheckCircle,
  new_message: MessageSquare,
  collaborator_pending: Users,
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 2) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase.current
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      const notifs = data as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Marque tout comme lu à l'ouverture
  useEffect(() => {
    if (!open || unreadCount === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.current as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .then(() => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      });
  }, [open, unreadCount]);

  // Ferme sur clic extérieur
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="fixed top-3 right-4 z-[60]">
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-sm border border-[#f2f2f2] text-navy hover:bg-gray-50 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-white text-[9px] font-bold leading-none"
            style={{ backgroundColor: "#FF5455", fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-[#f2f2f2] overflow-hidden flex flex-col"
          style={{
            width: "min(380px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 80px)",
          }}
        >
          {/* En-tête */}
          <div className="px-5 py-4 border-b border-[#f2f2f2] flex items-center justify-between shrink-0">
            <h2
              className="font-display font-bold text-lg text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Notifications
            </h2>
            {notifications.some((n) => !n.is_read) && (
              <span
                className="text-xs text-[#6B6B6B]"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Tout marquer comme lu
              </span>
            )}
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <p
                className="px-5 py-10 text-sm text-center text-[#6B6B6B]"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Aucune notification pour l'instant.
              </p>
            ) : (
              notifications.map((notif) => {
                const Icon = NOTIF_ICONS[notif.type] ?? Bell;
                return (
                  <div
                    key={notif.id}
                    className="flex gap-3 px-5 py-4 border-b border-[#f2f2f2] last:border-0"
                    style={{ backgroundColor: notif.is_read ? "transparent" : "#F0F7FF" }}
                  >
                    {/* Icône */}
                    <div className="w-9 h-9 rounded-full bg-[#f2f2f2] flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#313131]" />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <p
                        className="text-sm font-bold text-black leading-snug"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                      >
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p
                          className="text-xs text-[#6B6B6B] line-clamp-2"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {notif.body}
                        </p>
                      )}
                      <p
                        className="text-[10px] text-[#9B9B9B] mt-0.5"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                      >
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>

                    {/* Point non-lu */}
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[#FF5455] shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
