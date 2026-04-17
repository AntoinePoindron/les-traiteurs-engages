import Link from "next/link";
import { Euro, Users, MapPin, ChevronRight, Building2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { QuoteRequest } from "@/types/database";

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

type StatusVariant = "new" | "sent" | "completed" | "quotes_refused" | "expired";

function resolveVariant(qrcStatus?: string, quoteStatus?: string | null): StatusVariant | null {
  if (!qrcStatus) return null;
  if (qrcStatus === "selected") return "new";
  if (qrcStatus === "responded") return "new";
  if (qrcStatus === "rejected") return "expired";
  if (qrcStatus === "closed")   return "expired";
  if (qrcStatus === "transmitted_to_client") {
    if (quoteStatus === "accepted") return "completed";
    if (quoteStatus === "refused") return "quotes_refused";
    return "sent";
  }
  return null;
}

// ── Carré décoratif client ─────────────────────────────────────

function CompanySquare() {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#F5F1E8" }}
    >
      <Building2 size={18} style={{ color: "#1A3A52" }} />
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────

interface RequestCardProps {
  request: Pick<
    QuoteRequest,
    | "id" | "title" | "event_date" | "event_address"
    | "guest_count" | "budget_global" | "meal_type"
    | "description" | "created_at"
  > & {
    client_name?: string;
    company_name?: string;
    is_new?: boolean;
    qrc_status?: string;
    quote_status?: string | null;
  };
}

// ── Composant principal ────────────────────────────────────────

export default function RequestCard({ request }: RequestCardProps) {
  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });

  const shortAddress =
    request.event_address.length > 35
      ? request.event_address.slice(0, 35) + "…"
      : request.event_address;

  const statusVariant = resolveVariant(request.qrc_status, request.quote_status);
  const mealLabel = MEAL_TYPE_LABELS[request.meal_type ?? ""] ?? request.meal_type ?? "—";

  const contact = request.client_name && request.company_name
    ? request.client_name
    : request.client_name;

  return (
    <Link
      href={`/caterer/requests/${request.id}`}
      className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
    >
      {/* Carré décoratif */}
      <CompanySquare />

      {/* Contenu */}
      <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
        <div className="flex flex-col gap-1 min-w-0">

          {/* Titre + entité */}
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <p className="text-sm font-bold text-black" style={mFont}>
              {mealLabel}
            </p>
            {request.company_name && (
              <p className="text-xs text-[#9CA3AF] truncate" style={mFont}>
                {request.company_name}
              </p>
            )}
            <span className="text-[10px] text-[#9CA3AF] shrink-0" style={mFont}>
              Créée le {formatDateTime(request.created_at)}
            </span>
          </div>

          {/* Méta inline */}
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
            <span className="text-xs text-[#6B7280]" style={mFont}>
              {mealLabel} · {eventDate}
            </span>
            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
              <Users size={10} className="shrink-0" />
              {request.guest_count}
            </span>
            {request.budget_global != null && (
              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                <Euro size={10} className="shrink-0" />
                {request.budget_global.toLocaleString("fr-FR")}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
              <MapPin size={10} className="shrink-0" />
              <span className="truncate max-w-[160px]">{shortAddress}</span>
            </span>
          </div>
        </div>

        {/* Badge + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {statusVariant && <StatusBadge variant={statusVariant} />}
          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
        </div>
      </div>
    </Link>
  );
}
