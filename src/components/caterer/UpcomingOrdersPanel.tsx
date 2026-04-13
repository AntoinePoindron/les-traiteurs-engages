import Link from "next/link";
import { Calendar, MapPin, User } from "lucide-react";
import type { Order } from "@/types/database";

interface UpcomingOrder extends Pick<Order, "id" | "delivery_date" | "delivery_address"> {
  company_name: string;
  contact_name?: string;
  contact_phone?: string;
}

interface UpcomingOrdersPanelProps {
  orders: UpcomingOrder[];
}

export default function UpcomingOrdersPanel({ orders }: UpcomingOrdersPanelProps) {
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-6 w-full md:w-[324px]">
      <h2
        className="font-display font-bold text-2xl text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        Commandes à venir
      </h2>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-medium" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
          Aucune commande à venir.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-[#f2f2f2]">
          {orders.map((order, idx) => {
            const date = new Date(order.delivery_date).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const shortAddress =
              order.delivery_address.length > 35
                ? order.delivery_address.slice(0, 35) + "..."
                : order.delivery_address;

            return (
              <div key={order.id} className={`flex flex-col gap-3 ${idx > 0 ? "pt-6" : ""} ${idx < orders.length - 1 ? "pb-6" : ""}`}>
                <p
                  className="text-base font-bold text-black"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  {order.company_name}
                </p>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar size={16} className="text-[#313131] shrink-0" />
                    <span className="text-xs text-[#313131]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                      {date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={16} className="text-[#313131] shrink-0" />
                    <span className="text-xs text-[#313131]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                      {shortAddress}
                    </span>
                  </div>
                  {order.contact_name && (
                    <div className="flex items-center gap-1">
                      <User size={16} className="text-[#313131] shrink-0" />
                      <span className="text-xs text-[#313131]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                        {order.contact_name}
                        {order.contact_phone ? ` - ${order.contact_phone}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/caterer/orders/${order.id}`}
                  className="text-xs font-bold text-navy underline"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  Voir détail
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
