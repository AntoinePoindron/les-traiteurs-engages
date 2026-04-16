import Link from "next/link";
import { MessageSquare, CheckCircle, Users, Bell } from "lucide-react";
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
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
}

interface NotificationsPanelProps {
  notifications: Notification[];
}

export default function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4 w-full md:w-[324px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="font-display font-bold text-2xl text-[#111827]"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          Notifications
        </h2>
        <Link
          href="/caterer/notifications"
          className="text-xs font-bold text-navy underline"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Voir tout
        </Link>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-6">
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-medium" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
            Aucune notification.
          </p>
        ) : (
          notifications.slice(0, 5).map((notif) => {
            const Icon = NOTIF_ICONS[notif.type] ?? Bell;
            return (
              <div key={notif.id} className="flex gap-3 items-start">
                {/* Icône */}
                <div className="w-10 h-10 rounded-full bg-[#f2f2f2] flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-[#313131]" />
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-sm font-bold text-[#111827] leading-tight"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {notif.title}
                    </p>
                    <p
                      className="text-xs text-[#6b7280] whitespace-nowrap shrink-0"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {notif.body && (
                    <p
                      className="text-xs text-[#374151] line-clamp-2"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {notif.body}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
