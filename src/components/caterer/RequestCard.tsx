import Link from "next/link";
import { Euro, Users, Calendar, MapPin } from "lucide-react";
import InfoChip from "@/components/ui/InfoChip";
import StatusBadge from "@/components/ui/StatusBadge";
import type { QuoteRequest } from "@/types/database";

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner",
  diner: "Dîner",
  cocktail: "Cocktail dinatoire",
  petit_dejeuner: "Petit-déjeuner",
  autre: "Apéritif",
};

interface RequestCardProps {
  request: Pick<
    QuoteRequest,
    | "id"
    | "title"
    | "event_date"
    | "event_address"
    | "guest_count"
    | "budget_global"
    | "meal_type"
  > & {
    client_name?: string;
    client_role?: string;
    is_new?: boolean;
  };
}

export default function RequestCard({ request }: RequestCardProps) {
  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const shortAddress =
    request.event_address.length > 40
      ? request.event_address.slice(0, 40) + "..."
      : request.event_address;

  return (
    <Link
      href={`/caterer/requests/${request.id}`}
      className="block border border-[#f2f2f2] rounded-lg p-6 hover:border-navy/20 hover:shadow-sm transition-all"
    >
      {/* Badge + nom */}
      <div className="flex flex-col gap-1 mb-4">
        {request.is_new && <StatusBadge variant="new" />}
        <h3
          className="font-display font-bold text-xl text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          {request.title}
        </h3>
        {request.client_name && (
          <p className="text-xs text-[#313131]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
            {request.client_name}
            {request.client_role ? ` - ${request.client_role}` : ""}
          </p>
        )}
      </div>

      {/* Type de repas */}
      <p
        className="text-xs font-bold mb-3"
        style={{ color: "#FF5455", fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {MEAL_TYPE_LABELS[request.meal_type] ?? request.meal_type}
      </p>

      {/* Info chips */}
      <div className="flex flex-wrap gap-6">
        {request.budget_global && (
          <InfoChip
            icon={Euro}
            label="Budget total"
            value={`${request.budget_global.toLocaleString("fr-FR")}€`}
          />
        )}
        <InfoChip
          icon={Users}
          label="Nombre de couverts"
          value={String(request.guest_count)}
        />
        <InfoChip
          icon={Calendar}
          label="Date"
          value={eventDate}
        />
        <InfoChip
          icon={MapPin}
          label="Lieu"
          value={shortAddress}
        />
      </div>
    </Link>
  );
}
