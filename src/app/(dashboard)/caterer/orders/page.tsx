import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, Users, Calendar, Euro, ShoppingBag } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { OrderStatus } from "@/types/database";

type OrderFilter = "all" | "confirmed" | "delivered" | "invoiced" | "paid" | "disputed";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

const FILTER_TABS: { value: OrderFilter; label: string }[] = [
  { value: "all",       label: "Toutes" },
  { value: "confirmed", label: "À venir" },
  { value: "delivered", label: "Livrées" },
  { value: "invoiced",    label: "Facturées" },
  { value: "paid",        label: "Payées" },
  { value: "disputed",    label: "Litige" },
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner:        "Déjeuner",
  diner:           "Dîner",
  cocktail:        "Cocktail",
  petit_dejeuner:  "Petit-déjeuner",
  pause_gourmande: "Pause gourmande",
  plateaux_repas:  "Plateaux repas",
  autre:           "Apéritif",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default async function CatererOrdersPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as OrderFilter) || "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users").select("caterer_id").eq("id", user!.id).single();
  const catererId = (profileData as { caterer_id: string | null } | null)?.caterer_id ?? "";

  let query = supabase
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address, created_at,
      quotes!inner (
        id, reference, total_amount_ht, caterer_id,
        quote_requests!inner (
          title, event_date, guest_count, meal_type,
          companies ( name )
        )
      )
    `)
    .eq("quotes.caterer_id", catererId)
    .order("delivery_date", { ascending: true });

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data: ordersData } = await query;

  type OrderRow = {
    id: string;
    status: OrderStatus;
    delivery_date: string;
    delivery_address: string;
    created_at: string;
    quotes: {
      id: string;
      reference: string | null;
      total_amount_ht: number;
      caterer_id: string;
      quote_requests: {
        title: string;
        event_date: string;
        guest_count: number;
        meal_type: string;
        companies: { name: string } | null;
      } | null;
    } | null;
  };

  const orders = (ordersData ?? []) as OrderRow[];

  return (
    <main className="flex-1" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: 1020 }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Liste des commandes
          </h1>

          {/* Filtres */}
          <div className="bg-white rounded-lg p-6 flex items-center gap-2 overflow-x-auto">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={tab.value === "all" ? "/caterer/orders" : `/caterer/orders?filter=${tab.value}`}
                  className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
                  style={{
                    ...mFont,
                    backgroundColor: isActive ? "#1A3A52" : "#F5F1E8",
                    color: isActive ? "#fff" : "#1A3A52",
                  }}
                >
                  {tab.label}
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
                {orders.map((order) => {
                  const qr = order.quotes?.quote_requests;
                  const mealLabel = MEAL_TYPE_LABELS[qr?.meal_type ?? ""] ?? qr?.meal_type ?? null;
                  const eventDate = qr?.event_date
                    ? new Date(qr.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                  const deliveryDate = new Date(order.delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

                  return (
                    <Link
                      key={order.id}
                      href={`/caterer/orders/${order.id}`}
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

                          {/* Titre + entreprise */}
                          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                            <p className="text-sm font-bold text-black" style={mFont}>
                              {mealLabel ?? "—"}
                            </p>
                            {qr?.companies?.name && (
                              <p className="text-xs text-[#9CA3AF] truncate" style={mFont}>
                                {qr.companies.name}
                              </p>
                            )}
                          </div>

                          {/* Méta inline */}
                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                              <Calendar size={10} className="shrink-0" />
                              {eventDate}
                            </span>
                            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                              <Calendar size={10} className="shrink-0" />
                              Livraison {deliveryDate}
                            </span>
                            {qr?.guest_count && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Users size={10} className="shrink-0" />
                                {qr.guest_count} convives
                              </span>
                            )}
                            {order.quotes?.total_amount_ht != null && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Euro size={10} className="shrink-0" />
                                {Number(order.quotes.total_amount_ht).toLocaleString("fr-FR")} HT
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badge + chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge variant={order.status as "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"} />
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
