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
  { label: "Demandes & Devis", href: "/caterer/requests", icon: FileText },
  { label: "Commandes", href: "/caterer/orders", icon: ShoppingBag },
  { label: "Facturation", href: "/caterer/invoices", icon: Receipt },
  { label: "Messagerie", href: "/caterer/messages", icon: MessageSquare },
  { label: "Mon profil", href: "/caterer/profile", icon: ChefHat },
  { label: "Paramètres", href: "/caterer/settings", icon: Settings },
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
    case "caterer":
      return catererNav;
    case "client_admin":
      return clientAdminNav;
    case "client_user":
      return clientUserNav;
    case "super_admin":
      return adminNav;
  }
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "caterer":
      return "Espace Traiteur";
    case "client_admin":
      return "Espace Client — Admin";
    case "client_user":
      return "Espace Client";
    case "super_admin":
      return "Administration";
  }
}

export default function Sidebar({
  role,
  catererName,
  companyName,
  userName,
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNav(role);
  const entityName = catererName ?? companyName ?? "";

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-dark text-white shrink-0">
      {/* Logo + identité */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center shrink-0">
            <ChefHat size={16} className="text-white" />
          </div>
          <span className="font-display text-sm font-semibold leading-tight">
            Les Traiteurs<br />Engagés
          </span>
        </div>

        {/* Badge rôle */}
        <div className="inline-flex items-center px-2 py-1 rounded-full bg-white/10 text-xs text-white/70">
          {getRoleLabel(role)}
        </div>

        {/* Nom de l'entité */}
        {entityName && (
          <p className="mt-2 text-sm font-medium text-white truncate">
            {entityName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-terracotta text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }
              `}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer : user + déconnexion */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-terracotta/30 flex items-center justify-center shrink-0">
            <User size={14} />
          </div>
          <span className="truncate">{userName ?? "Mon compte"}</span>
        </Link>

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
