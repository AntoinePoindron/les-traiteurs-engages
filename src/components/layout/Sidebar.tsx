"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  Receipt,
  MessageSquare,
  User,
  Settings,
  Users,
  Building2,
  CheckSquare,
  BarChart2,
  LogOut,
  ChefHat,
  Search,
  HelpCircle,
  Bell,
  CreditCard,
  MessageSquare as MsgIcon,
  CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, Notification } from "@/types/database";

// ── Nav config ─────────────────────────────────────────────────

type NavItem = { label: string; href: string; icon: React.ElementType };

const catererNav: NavItem[] = [
  { label: "Tableau de bord",    href: "/caterer/dashboard", icon: LayoutDashboard },
  { label: "Liste des demandes", href: "/caterer/requests",  icon: FileText },
  { label: "Liste des commandes",href: "/caterer/orders",    icon: ShoppingBag },
  { label: "Fiche traiteur",     href: "/caterer/profile",   icon: ChefHat },
  { label: "Paiements",          href: "/caterer/stripe",    icon: CreditCard },
  { label: "Messagerie",         href: "/caterer/messages",  icon: MessageSquare },
  { label: "Besoin d'aide",      href: "/caterer/help",      icon: HelpCircle },
];

const clientUserNav: NavItem[] = [
  { label: "Tableau de bord",      href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Trouver un traiteur",  href: "/client/search",    icon: Search },
  { label: "Mes demandes",         href: "/client/requests",  icon: FileText },
  { label: "Mes commandes",        href: "/client/orders",    icon: ShoppingBag },
  { label: "Messagerie",           href: "/client/messages",  icon: MessageSquare },
  { label: "Mon profil",           href: "/client/profile",   icon: User },
  { label: "Paramètres",           href: "/client/settings",  icon: Settings },
];

const clientAdminNav: NavItem[] = [
  { label: "Tableau de bord",     href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Trouver un traiteur", href: "/client/search",    icon: Search },
  { label: "Demandes",            href: "/client/requests",  icon: FileText },
  { label: "Commandes",           href: "/client/orders",    icon: ShoppingBag },
  { label: "Facturation",         href: "/client/invoices",  icon: Receipt },
  { label: "Équipe",              href: "/client/team",      icon: Users },
  { label: "Messagerie",          href: "/client/messages",  icon: MessageSquare },
  { label: "Mon profil",          href: "/client/profile",   icon: User },
  { label: "Paramètres structure", href: "/client/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Tableau de bord", href: "/admin/dashboard",     icon: LayoutDashboard },
  { label: "Qualification",   href: "/admin/qualification", icon: CheckSquare },
  { label: "Traiteurs",       href: "/admin/caterers",      icon: ChefHat },
  { label: "Clients",         href: "/admin/companies",     icon: Building2 },
  { label: "Messagerie",      href: "/admin/messages",      icon: MessageSquare },
  { label: "Commandes",       href: "/admin/orders",        icon: ShoppingBag },
  { label: "Paiements",       href: "/admin/payments",      icon: CreditCard },
  { label: "Facturation",     href: "/admin/invoices",      icon: Receipt },
  { label: "Statistiques",    href: "/admin/stats",         icon: BarChart2 },
  { label: "Paramètres",      href: "/admin/settings",      icon: Settings },
];

function getNav(role: UserRole): NavItem[] {
  switch (role) {
    case "caterer":      return catererNav;
    case "client_admin": return clientAdminNav;
    case "client_user":  return clientUserNav;
    case "super_admin":  return adminNav;
  }
}

// ── Notification icons ─────────────────────────────────────────

const NOTIF_ICONS: Record<string, React.ElementType> = {
  quote_request_received: Bell,
  quote_accepted:         CheckCircle,
  new_message:            MsgIcon,
  collaborator_pending:   Users,
  collaborator_approved:  CheckCircle,
};

/**
 * URL de destination au clic sur une notification, selon son type
 * et le rôle de l'utilisateur courant. Retourne null si la notif
 * n'est pas cliquable.
 */
function getNotifHref(type: string, role: UserRole): string | null {
  switch (type) {
    case "collaborator_pending":
      // L'admin va valider / refuser dans Équipe → Effectifs
      return role === "client_admin" ? "/client/team?tab=effectifs" : null;
    case "collaborator_approved":
      return "/client/dashboard";
    case "quote_request_received":
      return role === "caterer" ? "/caterer/requests" : null;
    case "quote_accepted":
      return role === "caterer" ? "/caterer/orders" : null;
    case "new_message":
      if (role === "caterer")      return "/caterer/messages";
      if (role === "client_admin" || role === "client_user") return "/client/messages";
      if (role === "super_admin")  return "/admin/messages";
      return null;
    default:
      return null;
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 2)  return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24)   return `Il y a ${hours} h`;
  return `Il y a ${days} j`;
}

// ── Helpers ────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Props ──────────────────────────────────────────────────────

interface SidebarProps {
  role: UserRole;
  catererName?: string;
  catererLogoUrl?: string;
  companyName?: string;
  companyLogoUrl?: string;
  userName?: string;
}

// ── Component ──────────────────────────────────────────────────

export default function Sidebar({ role, catererName, catererLogoUrl, companyName, companyLogoUrl, userName }: SidebarProps) {
  const pathname  = usePathname();
  const navItems  = getNav(role);
  const entityName = catererName ?? companyName ?? "";
  const entityLogoUrl = catererName ? catererLogoUrl : companyLogoUrl;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  // ── Notifications state
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]   = useState(0);
  const notifRef  = useRef<HTMLDivElement>(null);
  const supabase  = useRef(createClient());

  // ── Unread messages state
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const userIdRef = useRef<string | null>(null);

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

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Fetch unread message count
  const fetchUnreadMsgCount = useCallback(async (uid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase.current as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", uid)
      .eq("is_read", false);
    setUnreadMsgCount(count ?? 0);
  }, []);

  // ── Init: get user ID, fetch count, subscribe
  const msgChannelRef = useRef<ReturnType<typeof supabase.current.channel> | null>(null);

  useEffect(() => {
    let mounted = true;

    // Tear down any leftover channel from a previous effect run (handles StrictMode double-fire)
    if (msgChannelRef.current) {
      supabase.current.removeChannel(msgChannelRef.current);
      msgChannelRef.current = null;
    }

    supabase.current.auth.getUser().then(({ data }) => {
      if (!mounted) return; // cleanup already ran — bail out
      const uid = data.user?.id;
      if (!uid) return;
      userIdRef.current = uid;
      fetchUnreadMsgCount(uid);

      msgChannelRef.current = supabase.current
        .channel(`sidebar-unread-messages-${uid}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${uid}`,
          },
          () => {
            setUnreadMsgCount((prev) => prev + 1);
          }
        )
        .subscribe();
    });

    return () => {
      mounted = false;
      if (msgChannelRef.current) {
        supabase.current.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }
    };
  }, [fetchUnreadMsgCount]);

  // ── Reset count when user navigates to messages
  useEffect(() => {
    if (pathname.includes("/messages") && userIdRef.current) {
      // Give MessagingLayout a tick to mark as read, then re-fetch
      const t = setTimeout(() => {
        if (userIdRef.current) fetchUnreadMsgCount(userIdRef.current);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [pathname, fetchUnreadMsgCount]);

  useEffect(() => {
    if (!notifOpen || unreadCount === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.current as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)
      .then(() => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      });
  }, [notifOpen, unreadCount]);

  useEffect(() => {
    if (!notifOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifOpen]);

  return (
    <aside
      className="flex flex-col shrink-0 h-screen sticky top-0"
      style={{ width: 241, backgroundColor: "#fff", borderRight: "1px solid #F3F4F6" }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center px-5 py-6">
        <img 
              src="/images/logo-traiteurs-engages.svg" 
              alt="Logo Les Traiteurs Engagés" 
            />
      </div>

      {/* ── Entité ── */}
      {entityName && (
        <div className="px-5 pb-4 flex items-center gap-2">
          {entityLogoUrl && (
            <div className="w-7 h-7 rounded-full overflow-hidden bg-white shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entityLogoUrl} alt="" className="w-full h-full object-contain p-0.5" />
            </div>
          )}
          <span
            className="inline-block px-2 py-1 rounded-full text-[10px] font-bold text-[#1A3A52] truncate"
            style={{ backgroundColor: "#F0F4F8", ...mFont }}
          >
            {entityName}
          </span>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto py-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          const isMessages = item.href.endsWith("/messages");
          const showMsgDot = isMessages && unreadMsgCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#1A3A52] text-white"
                  : "text-[#6B7280] hover:bg-[#F5F1E8] hover:text-[#1A3A52]"
              }`}
              style={mFont}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {showMsgDot && (
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#FF5455" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className="px-4 py-4 flex flex-col gap-3"
        style={{ borderTop: "1px solid #F3F4F6" }}
      >
        {/* Utilisateur */}
        {userName && (
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
              style={{ backgroundColor: "#1A3A52", ...mFont }}
            >
              {initials(userName)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-xs font-bold text-[#1A1A1A] truncate"
                style={mFont}
              >
                {userName}
              </span>
              {(role === "client_admin" || role === "client_user") && (
                <span
                  className="text-[10px] font-bold truncate"
                  style={{ color: "#1A3A52", ...mFont }}
                >
                  {role === "client_admin" ? "Administrateur" : "Collaborateur"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cloche notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="group relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors cursor-pointer hover:bg-[#1A3A52]"
              style={{ backgroundColor: notifOpen ? "#1A3A52" : "#F3F4F6" }}
              aria-label="Notifications"
            >
              <Bell
                size={16}
                className="transition-colors group-hover:text-white"
                style={{ color: notifOpen ? "white" : "#6B7280" }}
              />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-white text-[9px] font-bold leading-none"
                  style={{ backgroundColor: "#FF5455", ...mFont }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Panel notifications — s'ouvre vers le haut */}
            {notifOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-[#F3F4F6] overflow-hidden flex flex-col"
                style={{ width: 360, maxHeight: "calc(100vh - 120px)" }}
              >
                <div className="px-5 py-4 border-b border-[#F3F4F6] shrink-0">
                  <h2
                    className="font-display font-bold text-lg text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Notifications
                  </h2>
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <p className="px-5 py-10 text-sm text-center text-[#9CA3AF]" style={mFont}>
                      Aucune notification pour l'instant.
                    </p>
                  ) : (
                    notifications.map((notif) => {
                      const Icon = NOTIF_ICONS[notif.type] ?? Bell;
                      const href = getNotifHref(notif.type, role);
                      const inner = (
                        <>
                          <div className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <Icon size={15} className="text-[#6B7280]" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <p className="text-sm font-bold text-black leading-snug" style={mFont}>
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="text-xs text-[#6B7280] line-clamp-2" style={mFont}>
                                {notif.body}
                              </p>
                            )}
                            <p className="text-[10px] text-[#9CA3AF] mt-0.5" style={mFont}>
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>
                          {!notif.is_read && (
                            <div className="w-2 h-2 rounded-full bg-[#FF5455] shrink-0 mt-1.5" />
                          )}
                        </>
                      );
                      const baseCls = "flex gap-3 px-5 py-4 border-b border-[#F3F4F6] last:border-0 transition-colors";
                      const bg = notif.is_read ? "transparent" : "#F0F7FF";
                      if (href) {
                        return (
                          <Link
                            key={notif.id}
                            href={href}
                            onClick={() => setNotifOpen(false)}
                            className={`${baseCls} hover:bg-[#F5F1E8] cursor-pointer`}
                            style={{ backgroundColor: bg }}
                          >
                            {inner}
                          </Link>
                        );
                      }
                      return (
                        <div
                          key={notif.id}
                          className={baseCls}
                          style={{ backgroundColor: bg }}
                        >
                          {inner}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Déconnexion */}
          <form action="/auth/signout" method="POST" className="flex-1">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors cursor-pointer"
              style={mFont}
            >
              <LogOut size={14} className="shrink-0" />
              <span>Déconnexion</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
