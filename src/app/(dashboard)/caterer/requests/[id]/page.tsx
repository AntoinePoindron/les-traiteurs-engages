import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Euro,
  UtensilsCrossed,
  Wine,
  Briefcase,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type {
  QuoteRequest,
  QuoteRequestCatererStatus,
  Quote,
} from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner",
  diner: "Dîner",
  cocktail: "Cocktail dinatoire",
  petit_dejeuner: "Petit-déjeuner",
  autre: "Apéritif",
};

type StatusVariant = "new" | "pending" | "sent" | "accepted" | "refused" | "expired";

function resolveStatusVariant(
  qrcStatus: QuoteRequestCatererStatus,
  quoteStatus?: string | null
): StatusVariant {
  if (qrcStatus === "rejected") return "expired";
  if (qrcStatus === "selected") return "new";
  if (quoteStatus === "accepted") return "accepted";
  if (quoteStatus === "refused") return "refused";
  if (quoteStatus === "expired") return "expired";
  if (qrcStatus === "transmitted_to_client") return "sent";
  return "pending";
}

export default async function CatererRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user!.id)
    .single();

  const catererId =
    (profileData as { caterer_id: string | null } | null)?.caterer_id ?? "";

  // Fetch assignment + full request details
  const { data: assignmentData } = await supabase
    .from("quote_request_caterers")
    .select(`
      id, status, responded_at, response_rank,
      quote_requests (
        id, title, event_date, event_start_time, event_end_time,
        event_address, guest_count,
        budget_global, budget_per_person, budget_flexibility,
        meal_type, is_full_day, meal_type_secondary,
        dietary_vegetarian, dietary_vegan, dietary_halal,
        dietary_kosher, dietary_gluten_free, dietary_other,
        drinks_included, drinks_details,
        service_waitstaff, service_equipment, service_decoration, service_other,
        description, status, created_at
      )
    `)
    .eq("quote_request_id", id)
    .eq("caterer_id", catererId)
    .single();

  if (!assignmentData) notFound();

  type AssignmentRow = {
    id: string;
    status: QuoteRequestCatererStatus;
    responded_at: string | null;
    response_rank: number | null;
    quote_requests: QuoteRequest | null;
  };

  const assignment = assignmentData as AssignmentRow;
  const request = assignment.quote_requests;
  if (!request) notFound();

  // Fetch most recent quote for this caterer on this request
  const { data: quoteData } = await supabase
    .from("quotes")
    .select(
      "id, total_amount_ht, amount_per_person, valorisable_agefiph, valid_until, status, created_at"
    )
    .eq("quote_request_id", id)
    .eq("caterer_id", catererId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const quote = quoteData as Quote | null;
  const statusVariant = resolveStatusVariant(assignment.status, quote?.status);

  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dietaryItems: string[] = [];
  if (request.dietary_vegetarian) dietaryItems.push("Végétarien");
  if (request.dietary_vegan) dietaryItems.push("Végan");
  if (request.dietary_halal) dietaryItems.push("Halal");
  if (request.dietary_kosher) dietaryItems.push("Kasher");
  if (request.dietary_gluten_free) dietaryItems.push("Sans gluten");

  const serviceItems: string[] = [];
  if (request.service_waitstaff) serviceItems.push("Personnel de service");
  if (request.service_equipment) serviceItems.push("Matériel / vaisselle");
  if (request.service_decoration) serviceItems.push("Décoration");

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div
          className="mx-auto flex flex-col gap-6"
          style={{ maxWidth: "1020px" }}
        >
          {/* Back */}
          <Link
            href="/caterer/requests"
            className="inline-flex items-center gap-1 text-xs font-bold text-navy w-fit"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            <ChevronLeft size={16} />
            Retour à la liste
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-2">
            <StatusBadge variant={statusVariant} />
            <h1
              className="font-display font-bold text-4xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              {request.title}
            </h1>
            <p
              className="text-xs text-[#313131]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              Demande reçue le{" "}
              {new Date(request.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>

          {/* Main grid */}
          <div className="flex gap-6 items-start">
            {/* Left : request details */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Event info */}
              <section className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <h2
                  className="font-display font-bold text-2xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Détails de l'événement
                </h2>

                <p
                  className="text-sm font-bold"
                  style={{
                    color: "#FF5455",
                    fontFamily: "Marianne, system-ui, sans-serif",
                  }}
                >
                  {MEAL_TYPE_LABELS[request.meal_type] ?? request.meal_type}
                  {request.is_full_day && request.meal_type_secondary
                    ? ` + ${MEAL_TYPE_LABELS[request.meal_type_secondary] ?? request.meal_type_secondary} (journée complète)`
                    : ""}
                </p>

                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <DetailRow
                    icon={<Calendar size={16} />}
                    label="Date"
                    value={eventDate}
                  />
                  {(request.event_start_time || request.event_end_time) && (
                    <DetailRow
                      icon={<Clock size={16} />}
                      label="Horaires"
                      value={[
                        request.event_start_time,
                        request.event_end_time,
                      ]
                        .filter(Boolean)
                        .join(" – ")}
                    />
                  )}
                  <DetailRow
                    icon={<MapPin size={16} />}
                    label="Lieu"
                    value={request.event_address}
                  />
                  <DetailRow
                    icon={<Users size={16} />}
                    label="Couverts"
                    value={`${request.guest_count} personnes`}
                  />
                  {request.budget_global != null && (
                    <DetailRow
                      icon={<Euro size={16} />}
                      label="Budget total"
                      value={`${request.budget_global.toLocaleString("fr-FR")} €${
                        request.budget_flexibility &&
                        request.budget_flexibility !== "none"
                          ? ` (±${request.budget_flexibility} %)`
                          : ""
                      }`}
                    />
                  )}
                  {request.budget_per_person != null && (
                    <DetailRow
                      icon={<Euro size={16} />}
                      label="Budget / personne"
                      value={`${request.budget_per_person.toLocaleString("fr-FR")} €`}
                    />
                  )}
                </div>

                {request.description && (
                  <div>
                    <p
                      className="text-xs font-bold text-black mb-1"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Description
                    </p>
                    <p
                      className="text-sm text-[#313131]"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {request.description}
                    </p>
                  </div>
                )}
              </section>

              {/* Dietary + drinks */}
              {(dietaryItems.length > 0 ||
                request.dietary_other ||
                request.drinks_included) && (
                <section className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <h2
                    className="font-display font-bold text-2xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Contraintes alimentaires & boissons
                  </h2>

                  {dietaryItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p
                        className="text-xs font-bold text-black"
                        style={{
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        Régimes alimentaires
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dietaryItems.map((item) => (
                          <Chip
                            key={item}
                            label={item}
                            icon={<UtensilsCrossed size={12} />}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {request.dietary_other && (
                    <div>
                      <p
                        className="text-xs font-bold text-black mb-1"
                        style={{
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        Autre contrainte
                      </p>
                      <p
                        className="text-sm text-[#313131]"
                        style={{
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        {request.dietary_other}
                      </p>
                    </div>
                  )}

                  {request.drinks_included && (
                    <div className="flex items-center gap-2">
                      <Wine size={16} className="text-[#313131]" />
                      <p
                        className="text-sm text-[#313131]"
                        style={{
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        Boissons incluses
                        {request.drinks_details
                          ? ` — ${request.drinks_details}`
                          : ""}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Services */}
              {(serviceItems.length > 0 || request.service_other) && (
                <section className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <h2
                    className="font-display font-bold text-2xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Services additionnels
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {serviceItems.map((item) => (
                      <Chip
                        key={item}
                        label={item}
                        icon={<Briefcase size={12} />}
                      />
                    ))}
                    {request.service_other && (
                      <Chip
                        label={request.service_other}
                        icon={<Briefcase size={12} />}
                      />
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right : action panel */}
            <div className="shrink-0" style={{ width: "324px" }}>
              <ActionPanel
                qrcStatus={assignment.status}
                quote={quote}
                requestId={id}
                responseRank={assignment.response_rank}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[#6B6B6B]">
        {icon}
        <span
          className="text-xs"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-sm font-bold text-black"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function Chip({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
      style={{
        backgroundColor: "#F5F1E8",
        color: "#1A3A52",
        fontFamily: "Marianne, system-ui, sans-serif",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function ActionPanel({
  qrcStatus,
  quote,
  requestId,
  responseRank,
}: {
  qrcStatus: QuoteRequestCatererStatus;
  quote: Quote | null;
  requestId: string;
  responseRank: number | null;
}) {
  // Archivée
  if (qrcStatus === "rejected") {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
        <StatusBadge variant="expired" customLabel="Archivée" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Cette demande a été archivée et n'est plus active.
        </p>
      </div>
    );
  }

  // Nouvelle — pas encore de devis
  if (qrcStatus === "selected") {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
        <StatusBadge variant="new" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Vous avez reçu cette demande. Créez votre devis pour y répondre.
        </p>
        <Link
          href={`/caterer/requests/${requestId}/quote/new`}
          className="inline-flex items-center justify-center px-4 py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{
            backgroundColor: "#1A3A52",
            fontFamily: "Marianne, system-ui, sans-serif",
          }}
        >
          Créer mon devis
        </Link>
      </div>
    );
  }

  // Devis soumis mais pas dans la DB (ne devrait pas arriver)
  if (!quote) {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
        <StatusBadge variant="pending" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Votre réponse a été enregistrée.
        </p>
      </div>
    );
  }

  // Devis accepté
  if (quote.status === "accepted") {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
        <StatusBadge variant="accepted" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Votre devis a été accepté par le client. Une commande a été créée.
        </p>
        <QuoteSummary quote={quote} />
      </div>
    );
  }

  // Devis refusé
  if (quote.status === "refused") {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
        <StatusBadge variant="refused" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Le client n'a pas retenu votre devis.
        </p>
        <QuoteSummary quote={quote} />
      </div>
    );
  }

  // Devis expiré
  if (quote.status === "expired") {
    return (
      <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
        <StatusBadge variant="expired" />
        <p
          className="text-sm text-[#313131]"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Votre devis a expiré sans réponse du client.
        </p>
        <QuoteSummary quote={quote} />
      </div>
    );
  }

  // Devis envoyé / transmis au client
  const isTransmitted = qrcStatus === "transmitted_to_client";
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
      <StatusBadge variant={isTransmitted ? "sent" : "pending"} />
      <p
        className="text-sm text-[#313131]"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {isTransmitted
          ? `Votre devis a été transmis au client${responseRank ? ` (${responseRank}${responseRank === 1 ? "er" : "e"} répondant)` : ""}.`
          : "Votre devis a été envoyé et est en cours de traitement."}
      </p>
      <QuoteSummary quote={quote} />
    </div>
  );
}

function QuoteSummary({ quote }: { quote: Quote }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ backgroundColor: "#F5F1E8" }}
    >
      <p
        className="text-xs font-bold text-black"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        Votre devis
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className="text-xs text-[#6B6B6B]"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            Montant HT
          </span>
          <span
            className="text-sm font-bold text-black"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {quote.total_amount_ht.toLocaleString("fr-FR")} €
          </span>
        </div>

        {quote.amount_per_person != null && (
          <div className="flex items-center justify-between">
            <span
              className="text-xs text-[#6B6B6B]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              Par personne
            </span>
            <span
              className="text-xs text-[#313131]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              {quote.amount_per_person.toLocaleString("fr-FR")} €
            </span>
          </div>
        )}

        {quote.valorisable_agefiph != null && (
          <div className="flex items-center justify-between">
            <span
              className="text-xs text-[#6B6B6B]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              Valorisable AGEFIPH
            </span>
            <span
              className="text-xs font-bold"
              style={{
                color: "#6B7C4A",
                fontFamily: "Marianne, system-ui, sans-serif",
              }}
            >
              {quote.valorisable_agefiph.toLocaleString("fr-FR")} €
            </span>
          </div>
        )}

        {quote.valid_until && (
          <div className="flex items-center justify-between">
            <span
              className="text-xs text-[#6B6B6B]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              Valide jusqu'au
            </span>
            <span
              className="text-xs text-[#313131]"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              {new Date(quote.valid_until).toLocaleDateString("fr-FR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
