import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { ChevronRight, Euro, Users, Calendar, MapPin, ShoppingBag } from "lucide-react";
import type { OrderStatus } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const PRESTATION_LABELS: Record<string, string> = {
  petit_dejeuner:        "Petit déjeuner",
  pause_gourmande:       "Pause gourmande",
  plateaux_repas:        "Plateaux repas",
  cocktail_dinatoire:    "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif:     "Cocktail apéritif",
  dejeuner:              "Déjeuner",
  diner:                 "Dîner",
  cocktail:              "Cocktail",
  autre:                 "Autre",
};

type OrderFilter = "all" | "confirmed" | "delivered" | "invoiced" | "paid";

const FILTER_TABS: { key: OrderFilter; label: string }[] = [
  { key: "all",       label: "Toutes" },
  { key: "confirmed", label: "Confirmées" },
  { key: "delivered", label: "Livrées" },
  { key: "invoiced",  label: "Facturées" },
  { key: "paid",      label: "Payées" },
];

const ORDER_STATUS_VARIANT: Record<OrderStatus, "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"> = {
  confirmed:  "confirmed",
  delivered:  "delivered",
  invoiced:   "invoiced",
  paid:       "paid",
  disputed:   "disputed",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

// ── Page ───────────────────────────────────────────────────────

export default async function ClientOrdersPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as OrderFilter) || "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address, created_at,
      quotes!inner (
        total_amount_ht, valorisable_agefiph,
        caterers ( name, city, logo_url ),
        quote_requests ( id, title, guest_count, event_date, meal_type, service_type )
      )
    `)
    .eq("client_admin_id", user!.id)
    .order("created_at", { ascending: false });

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data: ordersRaw } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: any[] = ordersRaw ?? [];

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Mes commandes
          </h1>

          {/* Tabs filtres */}
          <div className="bg-white rounded-lg p-6 flex items-center gap-2 flex-wrap">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={key === "all" ? "/client/orders" : `/client/orders?filter=${key}`}
                  className="px-3 py-2 rounded-full text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isActive ? "#1A3A52" : "#F5F1E8",
                    color: isActive ? "#FFFFFF" : "#1A3A52",
                    ...mFont,
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Liste */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-6">

            <p className="text-xs font-bold text-black" style={mFont}>
              {orders.length} commande{orders.length !== 1 ? "s" : ""}
            </p>

            {orders.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#6B7280]" style={mFont}>
                  Aucune commande{activeFilter !== "all" ? " dans cette catégorie" : ""}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {orders.map((order: any) => {
                  const quote = order.quotes;
                  const caterer = quote?.caterers;
                  const qr = quote?.quote_requests;
                  const prestationLabel =
                    PRESTATION_LABELS[qr?.service_type ?? ""] ||
                    PRESTATION_LABELS[qr?.meal_type ?? ""] ||
                    qr?.service_type || qr?.meal_type || "—";
                  const eventDate = qr?.event_date
                    ? new Date(qr.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                  const shortAddress = order.delivery_address
                    ? (order.delivery_address.length > 35
                        ? order.delivery_address.slice(0, 35) + "…"
                        : order.delivery_address)
                    : null;

                  return (
                    <Link
                      key={order.id}
                      href={`/client/orders/${order.id}`}
                      className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                    >
                      {/* Icône carrée */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F5F1E8" }}
                      >
                        <ShoppingBag size={18} style={{ color: "#1A3A52" }} />
                      </div>

                      {/* Contenu */}
                      <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                        <div className="flex flex-col gap-1 min-w-0">

                          {/* Titre + traiteur */}
                          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                            <p className="text-sm font-bold text-black truncate" style={mFont}>
                              {prestationLabel}
                            </p>
                            {caterer?.name && (
                              <p className="text-xs text-[#9CA3AF] truncate shrink-0" style={mFont}>
                                {caterer.name}
                              </p>
                            )}
                          </div>

                          {/* Méta inline */}
                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                              <Calendar size={10} className="shrink-0" />
                              {eventDate}
                            </span>
                            {qr?.guest_count && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Users size={10} className="shrink-0" />
                                {qr.guest_count} convives
                              </span>
                            )}
                            {shortAddress && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <MapPin size={10} className="shrink-0" />
                                {shortAddress}
                              </span>
                            )}
                            {quote?.total_amount_ht != null && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Euro size={10} className="shrink-0" />
                                {Number(quote.total_amount_ht).toLocaleString("fr-FR")} HT
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badge + chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge variant={ORDER_STATUS_VARIANT[order.status as OrderStatus]} />
                          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
