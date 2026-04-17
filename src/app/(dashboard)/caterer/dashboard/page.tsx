import { createClient } from "@/lib/supabase/server";
import UpcomingOrdersPanel from "@/components/caterer/UpcomingOrdersPanel";
import StatusBadge from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Inbox, Clock, ShoppingBag, TrendingUp, ChevronRight, Euro, Users, MapPin, Building2 } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner:          "Déjeuner",
  diner:             "Dîner",
  cocktail:          "Cocktail dinatoire",
  cocktail_aperitif: "Cocktail apéritif",
  petit_dejeuner:    "Petit-déjeuner",
  pause_gourmande:   "Pause gourmande",
  plateaux_repas:    "Plateaux repas",
  autre:             "Autre",
};

// ── Page ───────────────────────────────────────────────────────

export default async function CatererDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, caterer_id, caterers(name, logo_url)")
    .eq("id", user!.id)
    .single();

  const profile = profileData as {
    first_name: string | null;
    caterer_id: string | null;
    caterers: { name: string; logo_url: string | null } | null;
  } | null;
  const catererId = profile?.caterer_id;
  const catererName = profile?.caterers?.name;
  const catererLogoUrl = profile?.caterers?.logo_url;

  // ── KPIs ────────────────────────────────────────────────────

  const { count: newRequestsCount } = await supabase
    .from("quote_request_caterers")
    .select("*", { count: "exact", head: true })
    .eq("caterer_id", catererId ?? "")
    .eq("status", "selected");

  const { count: pendingQuotesCount } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("caterer_id", catererId ?? "")
    .eq("status", "sent");

  const { count: activeOrdersCount } = await supabase
    .from("orders")
    .select("*, quotes!inner(caterer_id)", { count: "exact", head: true })
    .eq("quotes.caterer_id", catererId ?? "")
    .eq("status", "confirmed");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthOrders } = await supabase
    .from("orders")
    .select("quotes!inner(total_amount_ht, caterer_id)")
    .eq("quotes.caterer_id", catererId ?? "")
    .gte("created_at", startOfMonth.toISOString())
    .in("status", ["confirmed", "delivered", "invoiced", "paid"]);

  const caMonthly = (monthOrders ?? []).reduce((sum, o) => {
    const q = (o as { quotes: { total_amount_ht: number } | null }).quotes;
    return sum + (q?.total_amount_ht ?? 0);
  }, 0);

  // ── Demandes à traiter ──────────────────────────────────────

  const { data: assignedRequests } = await supabase
    .from("quote_request_caterers")
    .select(`
      status,
      quote_requests (
        id, title, event_date, event_address, guest_count,
        budget_global, meal_type, created_at,
        users ( first_name, last_name ),
        companies ( name )
      )
    `)
    .eq("caterer_id", catererId ?? "")
    .eq("status", "selected")
    .order("created_at", { ascending: false })
    .limit(5);

  const requests = (assignedRequests ?? [])
    .map((row) => {
      const r = row as {
        status: string;
        quote_requests: {
          id: string;
          title: string;
          event_date: string;
          event_address: string;
          guest_count: number;
          budget_global: number | null;
          meal_type: string;
          created_at: string;
          users: { first_name: string | null; last_name: string | null } | null;
          companies: { name: string } | null;
        } | null;
      };
      if (!r.quote_requests) return null;
      const u = r.quote_requests.users;
      return {
        ...r.quote_requests,
        client_name: u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : undefined,
        company_name: r.quote_requests.companies?.name ?? undefined,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      title: string;
      event_date: string;
      event_address: string;
      guest_count: number;
      budget_global: number | null;
      meal_type: string;
      created_at: string;
      client_name?: string;
      company_name?: string;
    }>;

  // ── Commandes à venir ───────────────────────────────────────

  const { data: upcomingOrdersData } = await supabase
    .from("orders")
    .select(`
      id, delivery_date, delivery_address,
      quotes!inner (
        caterer_id,
        quote_requests ( company_id, meal_type, companies ( name ) )
      )
    `)
    .eq("quotes.caterer_id", catererId ?? "")
    .eq("status", "confirmed")
    .gte("delivery_date", new Date().toISOString())
    .order("delivery_date", { ascending: true })
    .limit(3);

  const upcomingOrders = (upcomingOrdersData ?? []).map((o) => {
    const order = o as {
      id: string;
      delivery_date: string;
      delivery_address: string;
      quotes: {
        quote_requests: {
          meal_type: string | null;
          companies: { name: string } | null;
        } | null;
      } | null;
    };
    return {
      id: order.id,
      delivery_date: order.delivery_date,
      delivery_address: order.delivery_address,
      meal_type: order.quotes?.quote_requests?.meal_type ?? null,
      company_name: order.quotes?.quote_requests?.companies?.name ?? "—",
    };
  });

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <div className="flex items-center gap-4 min-w-0">
            {catererLogoUrl && (
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={catererLogoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Bonjour{profile?.first_name ? `, ${profile.first_name}` : ""} !
              </h1>
              {catererName && (
                <p className="text-sm text-[#6B7280] mt-1 truncate" style={mFont}>{catererName}</p>
              )}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={Inbox}       label="Nouvelles demandes"      value={String(newRequestsCount  ?? 0)} />
            <KpiCard icon={Clock}       label="Devis en attente"        value={String(pendingQuotesCount ?? 0)} />
            <KpiCard icon={ShoppingBag} label="Commandes en cours"      value={String(activeOrdersCount  ?? 0)} />
            <KpiCard
              icon={TrendingUp}
              label="CA prévisionnel"
              value={caMonthly > 0 ? `${caMonthly.toLocaleString("fr-FR")} €` : "—"}
            />
          </div>

          {/* Contenu principal : demandes + panneau droit */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* Colonne gauche : demandes à traiter */}
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Demandes à traiter
                </p>
                <Link
                  href="/caterer/requests"
                  className="text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  Voir tout
                </Link>
              </div>

              {requests.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-4" style={mFont}>
                  Aucune demande en attente.
                </p>
              ) : (
                <div className="flex flex-col">
                  {requests.map((req, i) => {
                    const eventDate = new Date(req.event_date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const mealLabel = MEAL_TYPE_LABELS[req.meal_type] ?? req.meal_type;
                    const shortAddr = req.event_address.length > 35
                      ? req.event_address.slice(0, 35) + "…"
                      : req.event_address;

                    return (
                      <Link
                        key={req.id}
                        href={`/caterer/requests/${req.id}`}
                        className="flex items-center gap-3 py-3.5 hover:bg-[#F5F1E8] -mx-2 px-2 rounded-lg transition-colors group"
                        style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : "none" }}
                      >
                        {/* Carré décoratif */}
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F5F1E8" }}>
                          <Building2 size={15} style={{ color: "#1A3A52" }} />
                        </div>

                        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                        <div className="flex flex-col gap-1 min-w-0">
                          {/* Titre + entité */}
                          <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                            <p className="text-sm font-bold text-black truncate" style={mFont}>
                              {mealLabel}
                            </p>
                            {req.company_name && (
                              <p className="text-xs text-[#9CA3AF] truncate shrink-0" style={mFont}>
                                {req.company_name}
                              </p>
                            )}
                            <span className="text-[10px] text-[#9CA3AF] shrink-0" style={mFont}>
                              Créée le {new Date(req.created_at).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                          {/* Infos compactes */}
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                            <span className="text-xs text-[#6B7280]" style={mFont}>{mealLabel} · {eventDate}</span>
                            {req.guest_count && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Users size={10} />
                                {req.guest_count}
                              </span>
                            )}
                            {req.budget_global && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Euro size={10} />
                                {req.budget_global.toLocaleString("fr-FR")}
                              </span>
                            )}
                            {shortAddr && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <MapPin size={10} />
                                {shortAddr}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge variant="new" />
                          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                        </div>
                        </div>{/* fin flex-1 */}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Colonne droite : commandes à venir */}
            <div className="w-full md:w-auto md:shrink-0">
              <UpcomingOrdersPanel orders={upcomingOrders} />
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#F0F4F7" }}
      >
        <Icon size={18} style={{ color: "#1A3A52" }} />
      </div>
      <div>
        <p
          className="font-display font-bold text-3xl text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          {value}
        </p>
        <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>{label}</p>
      </div>
    </div>
  );
}
