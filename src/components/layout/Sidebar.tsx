"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  Receipt,
  MessageSquare,
  User,
  Settings,
  Users,
  CheckSquare,
  BarChart2,
  LogOut,
  ChefHat,
  HelpCircle,
} from "lucide-react";
import type { UserRole } from "@/types/database";

interface SidebarProps {
  role: UserRole;
  catererName?: string;
  companyName?: string;
  userName?: string;
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const catererNav: NavItem[] = [
  { label: "Tableau de bord", href: "/caterer/dashboard", icon: LayoutDashboard },
  { label: "Liste des demandes", href: "/caterer/requests", icon: FileText },
  { label: "Liste des commandes", href: "/caterer/orders", icon: ShoppingBag },
  { label: "Fiche traiteur", href: "/caterer/profile", icon: ChefHat },
  { label: "Messagerie", href: "/caterer/messages", icon: MessageSquare },
  { label: "Besoin d'aide", href: "/caterer/help", icon: HelpCircle },
];

const clientUserNav: NavItem[] = [
  { label: "Tableau de bord", href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Mes demandes", href: "/client/requests", icon: FileText },
  { label: "Mes commandes", href: "/client/orders", icon: ShoppingBag },
  { label: "Messagerie", href: "/client/messages", icon: MessageSquare },
  { label: "Mon profil", href: "/client/profile", icon: User },
  { label: "Paramètres", href: "/client/settings", icon: Settings },
];

const clientAdminNav: NavItem[] = [
  { label: "Tableau de bord", href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Demandes", href: "/client/requests", icon: FileText },
  { label: "Commandes", href: "/client/orders", icon: ShoppingBag },
  { label: "Facturation", href: "/client/invoices", icon: Receipt },
  { label: "Équipe", href: "/client/team", icon: Users },
  { label: "Messagerie", href: "/client/messages", icon: MessageSquare },
  { label: "Paramètres", href: "/client/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Tableau de bord", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Qualification", href: "/admin/qualification", icon: CheckSquare },
  { label: "Traiteurs", href: "/admin/caterers", icon: ChefHat },
  { label: "Entreprises", href: "/admin/companies", icon: Users },
  { label: "Commandes", href: "/admin/orders", icon: ShoppingBag },
  { label: "Facturation", href: "/admin/invoices", icon: Receipt },
  { label: "Statistiques", href: "/admin/stats", icon: BarChart2 },
  { label: "Paramètres", href: "/admin/settings", icon: Settings },
];

function getNav(role: UserRole): NavItem[] {
  switch (role) {
    case "caterer": return catererNav;
    case "client_admin": return clientAdminNav;
    case "client_user": return clientUserNav;
    case "super_admin": return adminNav;
  }
}

export default function Sidebar({ role, catererName, companyName, userName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNav(role);
  const entityName = catererName ?? companyName ?? "";

  return (
    <aside
      className="flex flex-col bg-white shrink-0 h-screen sticky top-0"
      style={{ width: "241px", borderRight: "1px solid #f2f2f2" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="shrink-0 w-12 h-12 relative">
          <ChefHat size={28} className="text-navy" />
        </div>
        <span
          className="font-display font-bold text-navy leading-tight text-base"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          Les<br />Traiteurs<br />Engagés
        </span>
      </div>

      {/* Nom de l'entité */}
      {entityName && (
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-medium truncate">{entityName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-6 py-4 text-sm transition-colors duration-150
                ${isActive
                  ? "border-l-[6px] border-navy text-navy font-bold"
                  : "border-l-[6px] border-transparent text-black hover:text-navy hover:bg-gray-light"
                }
              `}
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              <Icon size={16} className="shrink-0 opacity-0 absolute" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-1">
        {userName && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-medium truncate">
            <User size={14} className="shrink-0" />
            <span className="truncate">{userName}</span>
          </div>
        )}
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-medium hover:text-dark hover:bg-gray-light transition-colors"
          >
            <LogOut size={14} className="shrink-0" />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
