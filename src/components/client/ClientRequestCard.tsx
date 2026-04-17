import Link from "next/link";
import { Euro, Users, MapPin, ChevronRight, FileText, ChefHat, LayoutGrid } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { QuoteRequestStatus } from "@/types/database";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_TYPE_LABELS: Record<string, string> = {
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

type ClientBadgeVariant =
  | "awaiting_quotes" | "quotes_received"
  | "completed" | "cancelled" | "quotes_refused";

function resolveVariant(
  status: QuoteRequestStatus,
  quotesReceivedCount: number,
  hasAcceptedQuote: boolean
): ClientBadgeVariant {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "quotes_refused") return "quotes_refused";
  if (hasAcceptedQuote) return "completed";
  if (quotesReceivedCount > 0) return "quotes_received";
  return "awaiting_quotes";
}

export interface ClientRequestCardData {
  id: string;
  title: string;
  service_type: string | null;
  meal_type: string | null;
  is_compare_mode: boolean;
  event_date: string;
  event_address: string;
  guest_count: number;
  budget_global: number | null;
  created_at: string;
  status: QuoteRequestStatus;
  quotes_received_count: number;
  has_accepted_quote: boolean;
  caterer_logo_url?: string | null;
  caterer_name?: string | null;
}

// ── Carré décoratif ────────────────────────────────────────────

function RequestSquare({ isCompare }: { isCompare: boolean }) {
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#F5F1E8" }}
    >
      {isCompare
        ? <LayoutGrid size={18} style={{ color: "#1A3A52" }} />
        : <ChefHat   size={18} style={{ color: "#1A3A52" }} />
      }
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────

export default function ClientRequestCard({ request }: { request: ClientRequestCardData }) {
  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });

  const serviceLabel =
    SERVICE_TYPE_LABELS[request.service_type ?? ""] ||
    SERVICE_TYPE_LABELS[request.meal_type ?? ""] ||
    request.service_type || request.meal_type || "—";

  const shortAddress =
    request.event_address.length > 35
      ? request.event_address.slice(0, 35) + "…"
      : request.event_address;

  const variant = resolveVariant(
    request.status,
    request.quotes_received_count,
    request.has_accepted_quote
  );

  return (
    <Link
      href={`/client/requests/${request.id}`}
      className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
    >
      {/* Carré décoratif */}
      <RequestSquare isCompare={request.is_compare_mode} />

      {/* Contenu */}
      <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <p className="text-sm font-bold text-black" style={mFont}>
              {serviceLabel}
            </p>
            <span className="text-[10px] text-[#9CA3AF]" style={mFont}>
              Créée le {formatDateTime(request.created_at)}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
            <span className="text-xs text-[#6B7280]" style={mFont}>
              {serviceLabel} · {eventDate}
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
            {request.quotes_received_count > 0 && !request.has_accepted_quote && (
              <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "#0284C7", ...mFont }}>
                <FileText size={10} className="shrink-0" />
                {request.quotes_received_count} devis
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge variant={variant} />
          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
        </div>
      </div>
    </Link>
  );
}
