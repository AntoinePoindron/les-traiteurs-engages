import { createClient } from "@/lib/supabase/server";
import {
  Building2, FileText, ShoppingBag, ChevronRight,
  TrendingUp, Users, Euro, ChefHat, LayoutGrid,
  Calendar, MapPin,
} from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import NewRequestDropdown from "@/components/client/NewRequestDropdown";
import type { QuoteRequestStatus, OrderStatus, UserRole } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_TYPE_LABELS: Record<string, string> = {
  petit_dejeuner:        "Petit déjeuner",
  pause_gourmande:       "Pause gourmande",
  plateaux_repas:        "Plateaux repas",
  cocktail_dinatoire:    "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif:     "Cocktail apéritif",
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
};

const ORDER_STATUS_VARIANT: Record<OrderStatus, "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"> = {
  confirmed:  "confirmed",
  delivered:  "delivered",
  invoiced:   "invoiced",
  paid:       "paid",
  disputed:   "disputed",
};

type ClientBadgeVariant =
  | "awaiting_quotes" | "quotes_received"
  | "completed" | "cancelled";

function resolveVariant(
  status: QuoteRequestStatus,
  quotesReceivedCount: number,
  hasAcceptedQuote: boolean,
): ClientBadgeVariant {
  if (status === "cancelled")   return "cancelled";
  if (status === "completed")   return "completed";
  if (hasAcceptedQuote)         return "completed";
  if (quotesReceivedCount > 0)  return "quotes_received";
  return "awaiting_quotes";
}

// ── Page ───────────────────────────────────────────────────────

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil + rôle
  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, role, company_id, companies(name, logo_url)")
    .eq("id", user!.id)
    .single();

  const profile = profileData as {
    first_name: string | null;
    role: UserRole;
    company_id: string | null;
    companies: { name: string; logo_url: string | null } | null;
  } | null;

  const isAdmin = profile?.role === "client_admin";
  const companyId = profile?.company_id;
  const companyName = profile?.companies?.name;
  const companyLogoUrl = profile?.companies?.logo_url;

  // ── Demandes en cours ──────────────────────────────────────
  // Admin : toutes les demandes de la company. User : ses propres demandes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeCountQuery = (supabase as any)
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("completed","cancelled")');
  if (isAdmin) {
    activeCountQuery.eq("company_id", companyId ?? "");
  } else {
    activeCountQuery.eq("client_user_id", user!.id);
  }
  const { count: activeCount } = await activeCountQuery;

  // ── Commandes confirmées ───────────────────────────────────
  // Admin : toutes les commandes de la company.
  // User : commandes qu'il a passées lui-même.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersCountQuery = (supabase as any)
    .from("orders")
    .select(
      isAdmin ? "id, quotes!inner(quote_requests!inner(company_id))" : "id",
      { count: "exact", head: true }
    )
    .eq("status", "confirmed");
  if (isAdmin) {
    ordersCountQuery.eq("quotes.quote_requests.company_id", companyId ?? "");
  } else {
    ordersCountQuery.eq("client_admin_id", user!.id);
  }
  const { count: ordersCount } = await ordersCountQuery;

  // ── Budget consommé (devis acceptés) ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetQuery = (supabase as any)
    .from("quotes")
    .select("total_amount_ht, quote_requests!inner(company_id, client_user_id)")
    .eq("status", "accepted");
  if (isAdmin) {
    budgetQuery.eq("quote_requests.company_id", companyId ?? "");
  } else {
    budgetQuery.eq("quote_requests.client_user_id", user!.id);
  }
  const { data: budgetRows } = await budgetQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetTotal: number = (budgetRows ?? []).reduce((s: number, r: any) => s + Number(r.total_amount_ht ?? 0), 0);
  const budgetDisplay = budgetTotal > 0
    ? budgetTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €"
    : "0 €";

  // ── Dernières demandes (hors commandes créées) ─────────────
  // Admin : toutes les demandes de la company. User : ses propres demandes.
  // On récupère plus de 5 lignes car on filtre ensuite côté JS celles qui
  // ont un devis accepté (= commande créée), pour couvrir les demandes legacy
  // dont le status n'aurait pas été passé à 'completed'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentQuery = (supabase as any)
    .from("quote_requests")
    .select("id, title, status, service_type, meal_type, is_compare_mode, event_date, created_at, quote_request_caterers ( status, caterers ( logo_url, name ) ), quotes ( status )")
    .not("status", "in", '("completed","cancelled","quotes_refused")')
    .order("created_at", { ascending: false })
    .limit(15);
  if (isAdmin) {
    recentQuery.eq("company_id", companyId ?? "");
  } else {
    recentQuery.eq("client_user_id", user!.id);
  }
  const { data: recentRaw } = await recentQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentRequests: any[] = (recentRaw ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((req: any) => !(Array.isArray(req.quotes) && req.quotes.some((q: any) => q.status === "accepted")))
    .slice(0, 5);

  // ── Commandes récentes (admin et non-admin) ───────────────
  // Admin : toutes les commandes de la company.
  // User : ses propres commandes (client_admin_id = user.id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOrdersQuery = (supabase as any)
    .from("orders")
    .select(
      isAdmin
        ? `
          id, status, delivery_date,
          quotes!inner (
            total_amount_ht, valorisable_agefiph,
            caterers ( name ),
            quote_requests!inner ( id, title, event_date, company_service_id, service_type, meal_type, company_id )
          )
        `
        : `
          id, status, delivery_date,
          quotes!inner (
            total_amount_ht, valorisable_agefiph,
            caterers ( name ),
            quote_requests ( id, title, event_date, company_service_id, service_type, meal_type )
          )
        `
    )
    .order("created_at", { ascending: false })
    .limit(5);
  if (isAdmin) {
    recentOrdersQuery.eq("quotes.quote_requests.company_id", companyId ?? "");
  } else {
    recentOrdersQuery.eq("client_admin_id", user!.id);
  }
  const { data: recentOrdersRaw } = await recentOrdersQuery;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOrders: any[] = recentOrdersRaw ?? [];

  // ── Admin only ─────────────────────────────────────────────
  let services: { id: string; name: string; annual_budget: number }[] = [];
  const spendByService: Record<string, number> = {};
  let totalOrdersActive = 0;
  let agefiph = 0;

  if (isAdmin && companyId) {
    // Commandes actives (confirmed) — toute la company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: activeOrders } = await (supabase as any)
      .from("orders")
      .select("id, quotes!inner(quote_requests!inner(company_id))", { count: "exact", head: true })
      .eq("quotes.quote_requests.company_id", companyId)
      .eq("status", "confirmed");
    totalOrdersActive = activeOrders ?? 0;

    // Valorisable AGEFIPH total — toute la company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ageRows } = await (supabase as any)
      .from("quotes")
      .select("valorisable_agefiph, quote_requests!inner(company_id)")
      .eq("status", "accepted")
      .eq("quote_requests.company_id", companyId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agefiph = (ageRows ?? []).reduce((s: number, r: any) => s + Number(r.valorisable_agefiph ?? 0), 0);

    // Services
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: servicesRaw } = await (supabase as any)
      .from("company_services")
      .select("id, name, annual_budget")
      .eq("company_id", companyId)
      .order("name")
      .limit(6);
    services = servicesRaw ?? [];

    // Dépenses par service — toute la company
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expOrders } = await (supabase as any)
      .from("orders")
      .select(`quotes!inner(total_amount_ht, quote_requests!inner(company_id, company_service_id))`)
      .eq("quotes.quote_requests.company_id", companyId)
      .in("status", ["confirmed", "delivered", "invoiced", "paid"]);
    for (const o of expOrders ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sid = (o as any).quotes?.quote_requests?.company_service_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const amount = Number((o as any).quotes?.total_amount_ht ?? 0);
      if (sid) spendByService[sid] = (spendByService[sid] ?? 0) + amount;
    }
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre + CTA */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {companyLogoUrl && (
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={companyLogoUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <h1
                  className="font-display font-bold text-4xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Bonjour{profile?.first_name ? `, ${profile.first_name}` : ""} !
                </h1>
                {companyName && (
                  <p className="text-sm text-[#6B7280] mt-1 truncate" style={mFont}>{companyName}</p>
                )}
              </div>
            </div>
            <NewRequestDropdown />
          </div>

          {/* KPI cards */}
          {isAdmin ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={FileText}    label="Demandes en cours"      value={String(activeCount       ?? 0)} href="/client/requests" />
              <KpiCard icon={ShoppingBag} label="Commandes confirmées"   value={String(totalOrdersActive)}     href="/client/orders" />
              <KpiCard icon={Building2}   label="Budget consommé"        value={budgetDisplay} />
              <KpiCard
                icon={TrendingUp}
                label="Val. AGEFIPH"
                value={agefiph > 0 ? agefiph.toLocaleString("fr-FR") + " €" : "—"}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard icon={FileText}    label="Demandes en cours"      value={String(activeCount  ?? 0)} href="/client/requests" />
              <KpiCard icon={ShoppingBag} label="Commandes confirmées"   value={String(ordersCount  ?? 0)} href="/client/orders" />
              <KpiCard icon={Building2}   label="Budget consommé"        value={budgetDisplay} />
            </div>
          )}

          {/* Layout 2 colonnes : demandes à gauche, commandes (+ widgets admin) à droite */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* Colonne gauche : demandes récentes */}
            <div className="flex-1 min-w-0 bg-white rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Dernières demandes
                </p>
                <Link
                  href="/client/requests"
                  className="text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  Voir tout
                </Link>
              </div>

              {recentRequests.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center gap-2">
                  <p className="text-sm text-[#6B7280]" style={mFont}>Aucune demande pour le moment.</p>
                  <Link
                    href="/client/requests/new"
                    className="text-sm font-bold text-[#1A3A52] underline underline-offset-2 hover:opacity-70 transition-opacity"
                    style={mFont}
                  >
                    Déposer une demande
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {recentRequests.map((req: any, i: number) => {
                    const qrcList     = Array.isArray(req.quote_request_caterers) ? req.quote_request_caterers : [];
                    const quoteList   = Array.isArray(req.quotes) ? req.quotes : [];
                    const receivedCount = qrcList.filter((q: any) => q.status === "transmitted_to_client").length;
                    const hasAccepted   = quoteList.some((q: any) => q.status === "accepted");
                    const variant       = resolveVariant(req.status as QuoteRequestStatus, receivedCount, hasAccepted);
                    const serviceLabel  = SERVICE_TYPE_LABELS[req.service_type ?? ""] ?? SERVICE_TYPE_LABELS[req.meal_type ?? ""] ?? "—";
                    const eventDate     = req.event_date
                      ? new Date(req.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                      : null;
                    const firstCaterer  = qrcList[0]?.caterers ?? null;

                    return (
                      <Link
                        key={req.id}
                        href={`/client/requests/${req.id}`}
                        className="flex items-center gap-3 py-3.5 hover:bg-[#F5F1E8] -mx-2 px-2 rounded-lg transition-colors group"
                        style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : "none" }}
                      >
                        {/* Carré décoratif */}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F5F1E8" }}>
                          {req.is_compare_mode
                            ? <LayoutGrid size={15} style={{ color: "#1A3A52" }} />
                            : <ChefHat    size={15} style={{ color: "#1A3A52" }} />
                          }
                        </div>

                        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                              <p className="text-sm font-bold text-black truncate" style={mFont}>
                                {serviceLabel}
                              </p>
                              <span className="text-[10px] text-[#9CA3AF] shrink-0" style={mFont}>
                                Créée le {new Date(req.created_at).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7280]" style={mFont}>
                              {serviceLabel}{eventDate ? ` · ${eventDate}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge variant={variant} />
                            <ChevronRight size={14} style={{ color: "#D1D5DB" }} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Colonne droite : commandes récentes (tous) + widgets admin */}
            <div className="flex flex-col gap-4 w-full lg:w-[340px] lg:shrink-0">

                {/* Commandes récentes */}
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p
                      className="font-display font-bold text-xl text-black"
                      style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                    >
                      Commandes récentes
                    </p>
                    <Link href="/client/orders" className="text-xs font-bold text-[#1A3A52] hover:opacity-70" style={mFont}>
                      Voir tout
                    </Link>
                  </div>

                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-[#6B7280] py-2" style={mFont}>Aucune commande.</p>
                  ) : (
                    <div className="flex flex-col">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {recentOrders.map((order: any, i: number) => {
                        const q  = order.quotes;
                        const qr = q?.quote_requests;
                        const prestationLabel =
                          SERVICE_TYPE_LABELS[qr?.service_type ?? ""] ||
                          SERVICE_TYPE_LABELS[qr?.meal_type ?? ""] ||
                          qr?.service_type || qr?.meal_type || "—";
                        return (
                          <Link
                            key={order.id}
                            href={`/client/orders/${order.id}`}
                            className="flex items-center justify-between gap-3 py-3 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors"
                            style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : "none" }}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <p className="text-sm font-bold text-black truncate" style={mFont}>
                                  {prestationLabel}
                                </p>
                                {q?.caterers?.name && (
                                  <p className="text-xs text-[#9CA3AF] truncate shrink-0" style={mFont}>
                                    {q.caterers.name}
                                  </p>
                                )}
                              </div>
                              <p className="text-xs text-[#6B7280]" style={mFont}>
                                {q?.caterers?.name}
                                {q?.total_amount_ht ? ` · ${Number(q.total_amount_ht).toLocaleString("fr-FR")} €` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge variant={ORDER_STATUS_VARIANT[order.status as OrderStatus]} />
                              <ChevronRight size={14} style={{ color: "#D1D5DB" }} />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dépenses par service */}
                {isAdmin && services.length > 0 && (
                  <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <p
                        className="font-display font-bold text-xl text-black"
                        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                      >
                        Dépenses par service
                      </p>
                      <Link href="/client/team?tab=depenses" className="text-xs font-bold text-[#1A3A52] hover:opacity-70" style={mFont}>
                        Détail
                      </Link>
                    </div>

                    <div className="flex flex-col gap-3">
                      {services.map((service) => {
                        const spent  = spendByService[service.id] ?? 0;
                        const budget = service.annual_budget ?? 0;
                        const pct    = budget > 0 ? Math.min(100, (spent / budget) * 100) : null;
                        const barColor = pct == null ? "#1A3A52" : pct > 90 ? "#DC2626" : pct > 70 ? "#F59E0B" : "#1A3A52";

                        return (
                          <div key={service.id} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-baseline">
                              <p className="text-xs font-bold text-black truncate flex-1 mr-2" style={mFont}>{service.name}</p>
                              <p className="text-xs text-[#6B7280] shrink-0" style={mFont}>
                                {spent.toLocaleString("fr-FR")} €
                                {budget > 0 && <span className="text-[#D1D5DB]"> / {budget.toLocaleString("fr-FR")} €</span>}
                              </p>
                            </div>
                            <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                              {(spent > 0 || pct == null) && (
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: pct != null ? `${pct}%` : "3px", backgroundColor: barColor }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

                {/* Lien Équipe si pas encore de services */}
                {isAdmin && services.length === 0 && (
                  <Link
                    href="/client/team"
                    className="bg-white rounded-lg p-6 flex items-center gap-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F0F4F7" }}>
                      <Users size={18} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black" style={mFont}>Configurer l'équipe</p>
                      <p className="text-xs text-[#6B7280]" style={mFont}>
                        Créez vos services et ajoutez vos collaborateurs pour suivre les dépenses.
                      </p>
                    </div>
                    <ChevronRight size={14} style={{ color: "#D1D5DB" }} />
                  </Link>
                )}

              </div>
          </div>

        </div>
      </div>
    </main>
  );
}

// ── KpiCard ────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-lg p-5 flex flex-col gap-3 ${href ? "hover:shadow-sm transition-shadow" : ""}`}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#F0F4F7" }}
      >
        <Icon size={18} style={{ color: "#1A3A52" }} />
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
          {value}
        </p>
        <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>{label}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
