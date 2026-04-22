import Link from "next/link";
import { ShoppingBag, Calendar, MapPin, ChevronRight, Building2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Order } from "@/types/database";

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

interface UpcomingOrder extends Pick<Order, "id" | "delivery_date" | "delivery_address"> {
  meal_type: string | null;
  company_name: string;
}

interface UpcomingOrdersPanelProps {
  orders: UpcomingOrder[];
}

export default function UpcomingOrdersPanel({ orders }: UpcomingOrdersPanelProps) {
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4 w-full md:w-[324px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p
          className="font-display font-bold text-xl text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          Commandes à venir
        </p>
        <Link
          href="/caterer/orders"
          className="text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
          style={mFont}
        >
          Voir tout
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-[#6B7280] py-4" style={mFont}>
          Aucune commande à venir.
        </p>
      ) : (
        <div className="flex flex-col">
          {orders.map((order, i) => {
            const date = new Date(order.delivery_date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const shortAddress =
              order.delivery_address.length > 28
                ? order.delivery_address.slice(0, 28) + "…"
                : order.delivery_address;

            const mealLabel = MEAL_TYPE_LABELS[order.meal_type ?? ""] ?? order.meal_type ?? "—";

            return (
              <Link
                key={order.id}
                href={`/caterer/orders/${order.id}`}
                className="flex items-center gap-3 py-3.5 hover:bg-[#F5F1E8] -mx-2 px-2 rounded-lg transition-colors group"
                style={{ borderTop: i > 0 ? "1px solid #F3F4F6" : "none" }}
              >
                {/* Carré décoratif */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#F5F1E8" }}
                >
                  <ShoppingBag size={15} style={{ color: "#1A3A52" }} />
                </div>

                {/* Contenu */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-sm font-bold text-black truncate" style={mFont}>
                      {mealLabel}
                    </p>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      {order.company_name && order.company_name !== "—" && (
                        <span className="flex items-center gap-0.5 text-xs text-[#6B7280] min-w-0" style={mFont}>
                          <Building2 size={10} className="shrink-0" />
                          <span className="truncate">{order.company_name}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                        <Calendar size={10} className="shrink-0" />
                        {date}
                      </span>
                      <span className="flex items-center gap-0.5 text-xs text-[#6B7280] min-w-0" style={mFont}>
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{shortAddress}</span>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge variant="confirmed" />
                  </div>
                  <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
