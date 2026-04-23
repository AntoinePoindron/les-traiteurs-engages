"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  XCircle,
  AlertCircle,
  AlertTriangle,
  Truck,
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
  { label: "Équipe",              href: "/client/team",      icon: Users },
  { label: "Messagerie",          href: "/client/messages",  icon: MessageSquare },
  { label: "Mon profil",          href: "/client/profile",   icon: User },
  { label: "Paramètres structure", href: "/client/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Tableau de bord", href: "/admin/dashboard",     icon: LayoutDashboard },
  { label: "Qualification",   href: "/admin/qualification", icon: CheckSquare },
  { label: "Commandes",       href: "/admin/orders",        icon: ShoppingBag },
  { label: "Traiteurs",       href: "/admin/caterers",      icon: ChefHat },
  { label: "Clients",         href: "/admin/companies",     icon: Building2 },
  { label: "Messagerie",      href: "/admin/messages",      icon: MessageSquare },
  { label: "Paiements",       href: "/admin/payments",      icon: CreditCard },
  { label: "Statistiques",    href: "/admin/stats",         icon: BarChart2 },
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
// Catalogue complet — à garder en sync avec les `type` produits par
// `lib/notifications.ts`. Tout type inconnu tombe sur Bell en fallback.

const NOTIF_ICONS: Record<string, React.ElementType> = {
  // Traiteur
  quote_request_received: Bell,
  quote_accepted:         CheckCircle,
  quote_refused:          XCircle,
  order_cancelled:        XCircle,
  invoice_paid:           CreditCard,
  payment_failed:         AlertCircle,
  dispute_opened:         AlertTriangle,
  // Client
  quote_received:         FileText,
  // order_delivered couvre aussi "facture émise" depuis qu'on a
  // fusionné les 2 events en une seule notif (cf. lib/stripe/invoices.ts)
  order_delivered:        Truck,
  collaborator_pending:   Users,
  collaborator_approved:  CheckCircle,
  // Super-admin
  new_caterer_signup:     ChefHat,
  new_request_to_qualify: FileText,
  dispute_opened_admin:   AlertTriangle,
  // Legacy (types qu'on n'émet plus mais qui peuvent exister en DB)
  invoice_issued:         Receipt,
  new_message:            MsgIcon,
  caterer_pending_qualification: ChefHat,
};

/**
 * URL de destination au clic sur une notification, selon son type, son
 * `related_entity_id` et le rôle de l'utilisateur courant. Retourne
 * null si la notif n'est pas cliquable (rôle incompatible, entité
 * manquante, etc.).
 *
 * Quand la notif porte un `related_entity_id`, on route vers la PAGE
 * DÉTAIL de l'objet (ex. `/caterer/orders/abc-123`). Sans entité, on
 * tombe sur la liste en fallback pour ne pas laisser la notif inerte.
 */
function getNotifHref(notif: Notification, role: UserRole): string | null {
  const { type, related_entity_id: eid } = notif;

  switch (type) {
    // ── Collaborateurs ──
    case "collaborator_pending":
      // tab=services est l'unique onglet effectifs depuis la fusion
      // avec services (bandeau "Demandes d'adhésion" en haut du tab).
      return role === "client_admin" ? "/client/team?tab=services" : null;
    case "collaborator_approved":
      return "/client/dashboard";

    // ── Traiteur : commandes (quote_accepted, paiements, litiges) ──
    case "quote_accepted":
    case "order_cancelled":
    case "invoice_paid":
    case "payment_failed":
    case "dispute_opened":
      if (role !== "caterer") return null;
      return eid ? `/caterer/orders/${eid}` : "/caterer/orders";

    // ── Traiteur : demandes (received, refused) ──
    case "quote_request_received":
    case "quote_refused":
      if (role !== "caterer") return null;
      return eid ? `/caterer/requests/${eid}` : "/caterer/requests";

    // ── Client : nouveau devis reçu sur sa demande ──
    case "quote_received":
      if (role !== "client_admin" && role !== "client_user") return null;
      return eid ? `/client/requests/${eid}` : "/client/requests";

    // ── Client : commande livrée, facture émise ──
    case "order_delivered":
    case "invoice_issued":
      if (role !== "client_admin" && role !== "client_user") return null;
      return eid ? `/client/orders/${eid}` : "/client/orders";

    // ── Super-admin ──
    case "new_caterer_signup":
    case "caterer_pending_qualification": // legacy (ancien nom)
      return role === "super_admin" ? "/admin/qualification" : null;
    case "new_request_to_qualify":
      // Page détail de la demande en qualif si on a l'id, sinon liste.
      if (role !== "super_admin") return null;
      return eid ? `/admin/qualification/${eid}` : "/admin/qualification";
    case "dispute_opened_admin":
      if (role !== "super_admin") return null;
      return eid ? `/admin/orders/${eid}` : "/admin/orders";

    // ── Messages (legacy — on n'émet plus ce type, mais on gère les
    //    notifs résiduelles en DB) ──
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
  const router    = useRouter();
  const navItems  = getNav(role);
  const entityName = catererName ?? companyName ?? "";
  const entityLogoUrl = catererName ? catererLogoUrl : companyLogoUrl;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  // ── Notifications state
  const [notifOpen, setNotifOpen]       = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]   = useState(0);
  // Deux refs : une pour le bouton (inline dans le footer sidebar),
  // une pour le panel (rendu via portal pour échapper au stacking
  // context). Le click-outside check vérifie que le clic n'est ni sur
  // l'un ni sur l'autre avant de fermer.
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef  = useRef<HTMLDivElement>(null);
  const supabase  = useRef(createClient());

  // Portal target : on ne monte la cloche qu'après mount côté client
  // pour éviter un mismatch d'hydratation (document.body indisponible
  // côté serveur).
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);

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

  // ── Refetch au changement de route ──
  // Les pages serveur appellent `dismissNotifications()` lors du load
  // (ex. consulter une commande dégage les notifs liées). Côté client,
  // la cloche garde un state local — il faut le resync. On refetch à
  // chaque navigation pour que la cloche reflète l'état DB en live.
  useEffect(() => {
    // On skip le premier mount (déjà couvert par l'effet ci-dessus).
    // Un timeout court laisse le temps à la page serveur de finir son
    // delete avant qu'on refetch, sinon on récupère les notifs qui
    // viennent juste d'être supprimées.
    const t = setTimeout(() => { fetchNotifications(); }, 300);
    return () => clearTimeout(t);
  }, [pathname, fetchNotifications]);

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

  // NOTE : pas d'auto-mark-as-read à l'ouverture du panel.
  // Une notif reste "non-lue" (pastille rouge + comptée dans la cloche)
  // tant que l'user n'a pas cliqué dessus (→ dismiss + delete) ou
  // consulté la page cible (→ dismiss côté server via le refetch post-
  // navigation). Simplement "voir" le panel ne suffit pas — la notif
  // appelle une action.

  useEffect(() => {
    if (!notifOpen) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      // Fermer si le clic n'est ni sur le bouton (sidebar) ni dans
      // le panel (portal). On ignore explicitement les clics du
      // bouton pour que le toggle continue à marcher.
      const inButton = notifButtonRef.current?.contains(target);
      const inPanel  = notifPanelRef.current?.contains(target);
      if (!inButton && !inPanel) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [notifOpen]);

  // ── Panel notifs (rendu via portal) ──
  // Le bouton cloche est rendu inline dans le footer de la sidebar (à
  // droite du user). Le panel, lui, passe par un portal sur
  // document.body pour échapper aux stacking contexts et pouvoir
  // déborder de la sidebar.
  //
  // Position : à DROITE de la sidebar (left: 249 = largeur sidebar 241
  // + 8px de marge), ancré sur le bas (bottom: 16) pour s'aligner avec
  // le footer. Comme ça le panel ne recouvre jamais la cloche — il
  // s'ouvre dans l'espace du contenu principal.
  const panelPortal = portalReady && notifOpen
    ? createPortal(
        <div
          ref={notifPanelRef}
          className="fixed bg-white rounded-xl shadow-xl border border-[#F3F4F6] overflow-hidden flex flex-col"
          style={{
            left: 249,
            bottom: 16,
            width: 360,
            maxHeight: "calc(100vh - 40px)",
            zIndex: 9999,
          }}
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
                    Aucune notification pour l&apos;instant.
                  </p>
                ) : (
                  notifications.map((notif) => {
                    const Icon = NOTIF_ICONS[notif.type] ?? Bell;
                    const href = getNotifHref(notif, role);

                    // Au clic : on retire de l'UI immédiatement (optimiste),
                    // on supprime en DB, on ferme le panel et on navigue si
                    // la notif porte un href. Si la suppression DB échoue,
                    // on loggue — au prochain refetch la notif réapparaîtra.
                    //
                    // IMPORTANT : supabase-js v2 est paresseux, une query
                    // n'est envoyée que si on await/then. Sans ça, on avait
                    // l'impression que le delete passait (le state filter
                    // maskait la notif) mais DB inchangée → refresh ramenait
                    // la notif. D'où le `.then(...)` explicite ci-dessous.
                    const handleClick = () => {
                      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                      setUnreadCount((prev) =>
                        notif.is_read ? prev : Math.max(0, prev - 1),
                      );
                      setNotifOpen(false);

                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (supabase.current as any)
                        .from("notifications")
                        .delete()
                        .eq("id", notif.id)
                        .then(({ error }: { error: unknown }) => {
                          if (error) {
                            console.error(
                              "[notifications] client-side delete failed:",
                              error,
                            );
                          }
                        });

                      // Navigation : on push juste après avoir fermé le panel.
                      // Le push est asynchrone côté Next mais commence tout
                      // de suite — la fermeture du panel (via setNotifOpen)
                      // n'interrompt pas la navigation.
                      if (href) router.push(href);
                    };

                    // IMPORTANT : on passe le background via className (pas
                    // inline style) sinon le `:hover` de Tailwind ne bat
                    // pas l'inline style (spécificité : inline > class, donc
                    // hover était overridé par `backgroundColor: bg`).
                    const bgCls = notif.is_read
                      ? "bg-transparent hover:bg-[#F5F1E8]"
                      : "bg-[#F0F7FF] hover:bg-[#E3ECF7]";

                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={handleClick}
                        className={`w-full flex gap-3 px-5 py-4 border-b border-[#F3F4F6] last:border-0 transition-colors text-left cursor-pointer ${bgCls}`}
                      >
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
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: "#FF5455" }}
                            aria-label="Non lue"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
    {panelPortal}

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
        {/* Utilisateur + cloche notifications */}
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

            {/* Cloche notifications — inline à droite du nom.
                Hover : cream `#F5F1E8` (couleur accent du site). On
                passe par une classe conditionnelle plutôt qu'un style
                inline pour que le `:hover` de Tailwind ne soit pas
                écrasé par l'inline `backgroundColor` (spécificité CSS :
                inline > class, même sur pseudo-classes). */}
            <button
              ref={notifButtonRef}
              onClick={() => setNotifOpen((v) => !v)}
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer shrink-0 ${
                notifOpen
                  ? "bg-[#1A3A52] hover:bg-[#15304A]"
                  : "bg-transparent hover:bg-[#F5F1E8]"
              }`}
              aria-label="Notifications"
            >
              <Bell
                size={16}
                className={notifOpen ? "text-white" : "text-[#6B7280]"}
              />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-white text-[9px] font-bold leading-none"
                  style={{ backgroundColor: "#FF5455", ...mFont }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Déconnexion */}
        <form action="/auth/signout" method="POST">
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
    </aside>
    </>
  );
}
