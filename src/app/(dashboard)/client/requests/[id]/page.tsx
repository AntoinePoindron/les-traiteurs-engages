import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, CheckCircle, Clock, Euro, Users, ShoppingBag, Pencil, FileText, Calendar, MapPin, Utensils, Percent } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import OrderCreatedModal from "@/components/client/OrderCreatedModal";
import QuoteViewerButton from "@/components/caterer/QuoteViewerButton";
import RefuseQuoteButton from "@/components/client/RefuseQuoteButton";
import type { CatererInfo, PreviewData } from "@/components/caterer/QuotePreviewModal";
import type { QuoteRequestStatus } from "@/types/database";
import { formatDateTime } from "@/lib/format";
import { acceptQuoteAction, refuseQuoteAction, cancelRequestAction } from "./actions";

interface PageProps {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ accepted?: string }>;
}

// ── Constants ──────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  petit_dejeuner:        "Petit déjeuner",
  pause_gourmande:       "Pause gourmande",
  plateaux_repas:        "Plateaux repas",
  cocktail_dinatoire:    "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif:     "Cocktail apéritif",
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
};

const FLEXIBILITY_LABELS: Record<string, string> = {
  none: "Budget fixe", "5": "Flexible (± 5%)", "10": "Flexible (± 10%)",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// ── Status helpers ─────────────────────────────────────────────

type ClientBadgeVariant =
  | "awaiting_quotes" | "quotes_received"
  | "completed" | "cancelled" | "quotes_refused";

function resolveVariant(
  status: QuoteRequestStatus,
  quotesCount: number,
  hasAccepted: boolean
): ClientBadgeVariant {
  if (status === "cancelled") return "cancelled";
  if (status === "completed" || hasAccepted) return "completed";
  if (status === "quotes_refused") return "quotes_refused";
  if (quotesCount > 0) return "quotes_received";
  return "awaiting_quotes";
}


// ── Page ───────────────────────────────────────────────────────

export default async function ClientRequestDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { accepted: acceptedOrderId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch request (owned by current user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqData } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, title, status, created_at, updated_at,
      service_type, service_type_secondary, is_full_day, meal_type, meal_type_secondary,
      event_date, event_start_time, event_end_time, event_address, guest_count,
      budget_global, budget_per_person, budget_flexibility,
      dietary_vegetarian, dietary_vegetarian_count,
      dietary_halal, dietary_halal_count,
      dietary_gluten_free, dietary_gluten_free_count,
      dietary_bio, dietary_other,
      drinks_water_still, drinks_water_sparkling, drinks_soft, drinks_soft_details,
      drinks_alcohol, drinks_alcohol_details, drinks_hot,
      service_waitstaff,
      service_equipment, service_equipment_verres, service_equipment_nappes, service_equipment_tables, service_equipment_other,
      service_setup, service_setup_time, service_setup_other,
      message_to_caterer, description, is_compare_mode
    `)
    .eq("id", id)
    // L'accès est géré par la RLS (déposant OU admin de la company)
    .single();

  if (!reqData) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = reqData as any;

  // Fetch caterers linked to this request (avec le statut qrc, sert
  // à filtrer les devis visibles ci-dessous : seuls les qrc en
  // "transmitted_to_client" remontent un devis côté client).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qrcData } = await (supabase as any)
    .from("quote_request_caterers")
    .select("status, caterers ( id, name, city, logo_url )")
    .eq("quote_request_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedCaterers: { id: string; name: string; city: string | null; logo_url: string | null }[] =
    (qrcData ?? []).map((r: any) => r.caterers).filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transmittedCatererIds: string[] = (qrcData ?? [])
    .filter((r: any) => r.status === "transmitted_to_client" && r.caterers)
    .map((r: any) => r.caterers.id);

  // User contact du traiteur (si un seul traiteur en demande directe).
  // Visibilité soumise à migration 013 : uniquement si qrc.status est
  // "transmitted_to_client" — sinon on affiche la carte sans contact.
  let catererUser: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null = null;
  if (linkedCaterers.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catererUserRow } = await (supabase as any)
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("caterer_id", linkedCaterers[0].id)
      .limit(1)
      .maybeSingle();
    catererUser = catererUserRow;
  }

  // Fetch transmitted quotes avec infos traiteur. En mode comparer-3,
  // on filtre sur les caterers dont le qrc est "transmitted_to_client"
  // (seuls les 3 premiers répondants). En mode direct, on garde tous
  // les devis sent/accepted/refused du traiteur désigné.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quotesQuery: any = (supabase as any)
    .from("quotes")
    .select(`
      id, reference, total_amount_ht, amount_per_person,
      valorisable_agefiph, valid_until, notes, details, status, created_at,
      caterers ( id, name, logo_url, city, address, zip_code, siret )
    `)
    .eq("quote_request_id", id)
    .in("status", ["sent", "accepted", "refused"])
    .order("created_at", { ascending: false });

  if (request.is_compare_mode) {
    if (transmittedCatererIds.length === 0) {
      quotesQuery = quotesQuery.eq("caterer_id", "00000000-0000-0000-0000-000000000000");
    } else {
      quotesQuery = quotesQuery.in("caterer_id", transmittedCatererIds);
    }
  }

  const { data: quotesData } = await quotesQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes: any[] = quotesData ?? [];
  // On affiche TOUS les devis reçus (sent/accepted/refused). Les refusés
  // conservent leur place dans la liste pour garder le compteur X/3
  // cohérent côté client et montrer son choix.
  const visibleQuotes = quotes;
  const acceptedQuote = quotes.find((q: any) => q.status === "accepted") ?? null;
  const hasPendingQuote = quotes.some((q: any) => q.status === "sent");

  // Commande associée (si devis accepté)
  let linkedOrderId: string | null = null;
  if (acceptedQuote) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderRef } = await (supabase as any)
      .from("orders")
      .select("id")
      .eq("quote_id", acceptedQuote.id)
      .maybeSingle();
    linkedOrderId = orderRef?.id ?? null;
  }

  const statusVariant = resolveVariant(
    request.status as QuoteRequestStatus,
    visibleQuotes.length,
    !!acceptedQuote
  );

  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Service type label
  const serviceLabel = SERVICE_TYPE_LABELS[request.service_type ?? ""] || SERVICE_TYPE_LABELS[request.meal_type ?? ""] || request.service_type || "—";
  const serviceLabelSecondary = request.is_full_day && request.service_type_secondary
    ? (SERVICE_TYPE_LABELS[request.service_type_secondary] ?? request.service_type_secondary)
    : null;

  // Drinks
  const drinkItems: string[] = [];
  if (request.drinks_water_still)    drinkItems.push("Eau plate");
  if (request.drinks_water_sparkling) drinkItems.push("Eau gazeuse");
  if (request.drinks_soft)           drinkItems.push(request.drinks_soft_details ? `Sodas / Soft — ${request.drinks_soft_details}` : "Sodas / Soft");
  if (request.drinks_alcohol)        drinkItems.push(request.drinks_alcohol_details ? `Alcool — ${request.drinks_alcohol_details}` : "Alcool");
  if (request.drinks_hot)            drinkItems.push("Thé, Café");

  // Services
  const serviceItems: { label: string; detail?: string }[] = [];
  if (request.service_waitstaff) serviceItems.push({ label: "Personnel" });
  if (request.service_equipment) {
    const sub = [
      request.service_equipment_verres && "Verres",
      request.service_equipment_nappes && "Nappes et serviettes",
      request.service_equipment_tables && "Tables",
    ].filter(Boolean).join(", ");
    serviceItems.push({ label: "Matériel", detail: sub || request.service_equipment_other || undefined });
    if (request.service_equipment_other && sub) serviceItems.push({ label: "Autre matériel", detail: request.service_equipment_other });
  }
  if (request.service_setup) {
    serviceItems.push({ label: "Installation et mise en place", detail: request.service_setup_time ? `à ${request.service_setup_time}` : undefined });
    if (request.service_setup_other) serviceItems.push({ label: "Précisions installation", detail: request.service_setup_other });
  }

  // Dietary
  const dietItems: { label: string; count?: number }[] = [];
  if (request.dietary_vegetarian) dietItems.push({ label: "Végétarien", count: request.dietary_vegetarian_count });
  if (request.dietary_gluten_free) dietItems.push({ label: "Sans gluten", count: request.dietary_gluten_free_count });
  if (request.dietary_halal) dietItems.push({ label: "Halal", count: request.dietary_halal_count });
  if (request.dietary_bio) dietItems.push({ label: "Produits bio" });

  return (
    <>
    {acceptedOrderId && <OrderCreatedModal orderId={acceptedOrderId} />}
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Back */}
          <BackButton label="Retour" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {request.title}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={mFont}>
                Créée le {formatDateTime(request.created_at)}
                {request.updated_at &&
                  new Date(request.updated_at).getTime() - new Date(request.created_at).getTime() > 60_000 && (
                    <>
                      {" · "}
                      <span>Modifiée le {formatDateTime(request.updated_at)}</span>
                    </>
                  )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {statusVariant === "awaiting_quotes" && visibleQuotes.length === 0 && (
                <Link
                  href={`/client/requests/${id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F0F4F8] transition-colors"
                  style={mFont}
                >
                  <Pencil size={12} />
                  Modifier
                </Link>
              )}
              <StatusBadge variant={statusVariant} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left : résumé + détails ── */}
            <div className="flex-1 min-w-0 w-full flex flex-col gap-6">

              {/* 0 — Résumé scannable (4 infos clés + type d'événement) */}
              <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                    >
                      <Calendar size={15} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Date
                      </span>
                      <span className="text-sm font-bold text-black truncate" style={mFont}>
                        {eventDate}
                        {(request.event_start_time || request.event_end_time) && (
                          <span className="font-normal">
                            {" · "}
                            {[request.event_start_time, request.event_end_time].filter(Boolean).join(" – ")}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                    >
                      <MapPin size={15} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Lieu
                      </span>
                      <span className="text-sm font-bold text-black truncate" style={mFont}>
                        {request.event_address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                    >
                      <Users size={15} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Convives
                      </span>
                      <span className="text-sm font-bold text-black truncate" style={mFont}>
                        {request.guest_count} personnes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                    >
                      <Utensils size={15} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Prestation
                      </span>
                      <span className="text-sm font-bold text-black truncate" style={mFont}>
                        {serviceLabel}
                        {serviceLabelSecondary && (
                          <span className="font-normal">
                            {" + "}
                            {serviceLabelSecondary}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {request.description && (
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{ backgroundColor: "#F5F1E8", color: "#000", ...mFont }}
                  >
                    <span className="font-bold">Type d&apos;événement · </span>
                    {request.description}
                  </div>
                )}
              </div>

              {/* 2 — La prestation (boissons + services additionnels) */}
              {(drinkItems.length > 0 || serviceItems.length > 0) && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p
                    className="font-display font-bold text-xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    La prestation
                  </p>
                  {drinkItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Boissons
                      </p>
                      <div className="flex flex-col gap-3">
                        {drinkItems.map((item) => <Row key={item} label={item} />)}
                      </div>
                    </div>
                  )}
                  {drinkItems.length > 0 && serviceItems.length > 0 && <Divider />}
                  {serviceItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                        Services additionnels
                      </p>
                      <div className="flex flex-col gap-3">
                        {serviceItems.map((item, i) => (
                          <Row key={i} label={item.label} value={item.detail} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3 — Préférences et contraintes alimentaires */}
              {(dietItems.length > 0 || request.dietary_other) && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p
                    className="font-display font-bold text-xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Préférences et contraintes
                  </p>
                  <div className="flex flex-col gap-3">
                    {dietItems.map((item) => (
                      <Row
                        key={item.label}
                        label={item.label}
                        value={item.count ? `${item.count} personnes` : undefined}
                      />
                    ))}
                    {request.dietary_other && (
                      <Row label="Autre" value={request.dietary_other} />
                    )}
                  </div>
                </div>
              )}

              {/* 4 — Message au traiteur */}
              {request.message_to_caterer && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p
                    className="font-display font-bold text-xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Message au traiteur
                  </p>
                  <p className="text-sm text-black whitespace-pre-wrap italic leading-relaxed" style={mFont}>
                    {request.message_to_caterer}
                  </p>
                </div>
              )}
            </div>

            {/* ── Right : statut demande + devis + traiteur ── */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              {/* 1 — Infos + actions sur la demande (l'objet) */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">


              {/* 2 — Demande en cours d'examen (état soumise, pas encore de devis) */}
              {visibleQuotes.length === 0 && statusVariant === "awaiting_quotes" && (
                <>
                  <div className="flex flex-col gap-2 py-2 items-center text-center">
                    <Clock size={28} className="text-[#D1D5DB]" />
                    <p className="text-sm font-bold text-black" style={mFont}>Demande en cours d&apos;examen</p>
                    <p className="text-xs text-[#9CA3AF]" style={mFont}>
                      Notre équipe vérifie votre demande avant de la transmettre aux traiteurs.
                    </p>
                  </div>
                  <Divider />
                </>
              )}

              {/* 4 — Devis reçus */}
              {(visibleQuotes.length > 0 || request.is_compare_mode) && (
                <>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                        Devis reçus
                      </p>
                      {request.is_compare_mode && (
                        <span
                          className="flex items-center gap-0.5 text-xs font-bold shrink-0"
                          style={{
                            color: visibleQuotes.length === 0 ? "#B45309" : "#0284C7",
                            ...mFont,
                          }}
                        >
                          <FileText size={10} className="shrink-0" />
                          {visibleQuotes.length}/3 devis
                        </span>
                      )}
                    </div>
                    {visibleQuotes.length === 0 && request.is_compare_mode && (
                      <p className="text-xs text-[#6B7280]" style={mFont}>
                        En attente des 3 premiers devis. Vous serez notifié au fur et à mesure.
                      </p>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {visibleQuotes.map((quote: any) => (
                      <QuoteCard
                        key={quote.id}
                        quote={quote}
                        requestId={id}
                        eventDate={request.event_date}
                        eventAddress={request.event_address}
                        guestCount={request.guest_count}
                        mealTypeLabel={serviceLabel}
                        isAccepted={quote.status === "accepted"}
                        isRefused={quote.status === "refused"}
                        canAccept={!acceptedQuote && quote.status === "sent"}
                      />
                    ))}
                    {hasPendingQuote && !acceptedQuote && request.status !== "cancelled" && request.status !== "completed" && (
                      <form action={cancelRequestAction}>
                        <input type="hidden" name="request_id" value={id} />
                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#DC2626] hover:bg-[#FFF5F5] transition-colors"
                          style={mFont}
                        >
                          Ne retenir aucun devis
                        </button>
                      </form>
                    )}
                  </div>
                  <Divider />
                </>
              )}

              {/* 5 — Budget résumé (icône + label + valeur) */}
              {(request.budget_global || request.budget_per_person || request.budget_flexibility) && (
                <div className="flex flex-col gap-3">
                  {request.budget_global && (
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                      >
                        <Euro size={15} style={{ color: "#1A3A52" }} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                          Budget total
                        </span>
                        <span className="text-sm font-bold text-black truncate" style={mFont}>
                          {Number(request.budget_global).toLocaleString("fr-FR")} €
                        </span>
                      </div>
                    </div>
                  )}
                  {request.budget_per_person && (
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                      >
                        <Users size={15} style={{ color: "#1A3A52" }} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                          Par personne
                        </span>
                        <span className="text-sm font-bold text-black truncate" style={mFont}>
                          {Number(request.budget_per_person).toLocaleString("fr-FR")} €
                        </span>
                      </div>
                    </div>
                  )}
                  {request.budget_flexibility && (
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
                      >
                        <Percent size={15} style={{ color: "#1A3A52" }} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase text-black" style={{ letterSpacing: "0.06em", ...mFont }}>
                          Flexibilité
                        </span>
                        <span className="text-sm font-bold text-black truncate" style={mFont}>
                          {FLEXIBILITY_LABELS[request.budget_flexibility] ?? request.budget_flexibility}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 6 — Commande associée (devis accepté) — en bas du panneau */}
              {linkedOrderId && (
                <Link
                  href={`/client/orders/${linkedOrderId}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  <ShoppingBag size={13} />
                  Voir la commande
                </Link>
              )}
              </div>

              {/* 2 — Traiteur contacté (demande directe) — carte complète, sous la demande */}
              {!request.is_compare_mode && linkedCaterers.length === 1 && (
                <ContactCard
                  entityType="caterer"
                  entityName={linkedCaterers[0].name}
                  entityLogoUrl={linkedCaterers[0].logo_url}
                  contactUserId={catererUser?.id ?? null}
                  contactFirstName={catererUser?.first_name ?? null}
                  contactLastName={catererUser?.last_name ?? null}
                  contactEmail={catererUser?.email ?? null}
                  publicProfileHref={`/client/caterers/${linkedCaterers[0].id}`}
                  myUserId={user!.id}
                  quoteRequestId={id}
                  messagesHref="/client/messages"
                />
              )}

              {/* Fallback : plusieurs traiteurs liés (cas rare hors compare mode) */}
              {!request.is_compare_mode && linkedCaterers.length > 1 && (
                <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
                  <p className="font-display font-bold text-lg text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Traiteurs contactés
                  </p>
                  {linkedCaterers.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/client/caterers/${cat.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[#F3F4F6] hover:border-[#1A3A52]/30 hover:bg-[#F5F1E8] transition-all"
                    >
                      {cat.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.logo_url} alt="" className="h-8 w-auto max-w-[120px] object-contain shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ backgroundColor: "#1A3A52" }}>
                          {cat.name[0]}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-black truncate" style={mFont}>{cat.name}</span>
                        {cat.city && <span className="text-xs text-[#6B7280]" style={mFont}>{cat.city}</span>}
                      </div>
                      <ChevronLeft size={14} className="text-[#9CA3AF] ml-auto shrink-0 rotate-180" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

// ── Quote card ─────────────────────────────────────────────────

function QuoteCard({
  quote, requestId, eventDate, eventAddress, guestCount, mealTypeLabel,
  isAccepted, isRefused, canAccept,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote: any;
  requestId: string;
  eventDate: string;
  eventAddress: string;
  guestCount: number;
  mealTypeLabel: string;
  isAccepted: boolean;
  isRefused: boolean;
  canAccept: boolean;
}) {
  const caterer = quote.caterers;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  // Build preview data for the quote viewer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(quote.details) ? quote.details : [];
  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const tva = item.tva_rate ?? 0;
    const lineHT = (item.quantity ?? 0) * (item.unit_price_ht ?? 0);
    tvaMap[tva] = (tvaMap[tva] ?? 0) + lineHT * (tva / 100);
  }
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);

  const catererInfo: CatererInfo = {
    name:     caterer?.name ?? "",
    address:  caterer?.address ?? null,
    city:     caterer?.city ?? null,
    zip_code: caterer?.zip_code ?? null,
    siret:    caterer?.siret ?? null,
    logo_url: caterer?.logo_url ?? null,
  };

  const previewData: PreviewData = {
    reference:     quote.reference ?? "",
    validUntil:    quote.valid_until ?? "",
    notes:         quote.notes ?? "",
    items:         items.map((item: any, idx: number) => ({
      id:            item.id ?? String(idx),
      label:         item.label ?? "",
      description:   item.description ?? "",
      quantity:      item.quantity ?? 1,
      unit_price_ht: item.unit_price_ht ?? 0,
      tva_rate:      item.tva_rate ?? 10,
      section:       item.section ?? "main",
    })),
    totalHT:       Number(quote.total_amount_ht ?? 0),
    tvaMap,
    totalTVA,
    totalTTC:      Number(quote.total_amount_ht ?? 0) + totalTVA,
    guestCount,
    eventDate:     new Date(eventDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    eventAddress,
    mealTypeLabel,
  };

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        backgroundColor: isAccepted ? "#DCFCE7" : isRefused ? "#F9FAFB" : "#F5F1E8",
        border: isAccepted
          ? "1px solid #16A34A40"
          : isRefused
            ? "1px solid #E5E7EB"
            : "none",
        opacity: isRefused ? 0.75 : 1,
      }}
    >
      {/* Traiteur */}
      <div className="flex items-center gap-2">
        {caterer?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={caterer.logo_url}
            alt=""
            className="h-6 w-auto max-w-[100px] object-contain shrink-0"
            style={{ filter: isRefused ? "grayscale(1)" : undefined }}
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#1A3A52]/10 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-[#1A3A52]" style={mFont}>
              {caterer?.name?.[0] ?? "?"}
            </span>
          </div>
        )}
        <p
          className="text-xs font-bold truncate"
          style={{ ...mFont, color: isRefused ? "#6B7280" : "#000", textDecoration: isRefused ? "line-through" : undefined }}
        >
          {caterer?.name ?? "Traiteur"}
        </p>
        {isAccepted && (
          <span className="ml-auto text-[10px] font-bold text-[#16A34A]" style={mFont}>Accepté</span>
        )}
        {isRefused && (
          <span className="ml-auto text-[10px] font-bold text-[#DC2626]" style={mFont}>Refusé</span>
        )}
      </div>

      {/* Montants */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-[#6B7280]" style={mFont}>Montant HT</span>
          <span className="text-sm font-bold text-black" style={mFont}>
            {Number(quote.total_amount_ht).toLocaleString("fr-FR")} €
          </span>
        </div>
        {quote.amount_per_person != null && (
          <div className="flex justify-between">
            <span className="text-xs text-[#6B7280]" style={mFont}>Par personne</span>
            <span className="text-xs font-bold text-black" style={mFont}>
              {Number(quote.amount_per_person).toLocaleString("fr-FR")} €
            </span>
          </div>
        )}
        {quote.valorisable_agefiph != null && (
          <div className="flex justify-between">
            <span className="text-xs text-[#6B7280]" style={mFont}>Val. AGEFIPH</span>
            <span className="text-xs font-bold text-black" style={mFont}>
              {Number(quote.valorisable_agefiph).toLocaleString("fr-FR")} €
            </span>
          </div>
        )}
        {quote.valid_until && (
          <div className="flex justify-between">
            <span className="text-xs text-[#6B7280]" style={mFont}>Valide jusqu&apos;au</span>
            <span className="text-xs text-[#6B7280]" style={mFont}>
              {new Date(quote.valid_until).toLocaleDateString("fr-FR")}
            </span>
          </div>
        )}
      </div>

      {/* Motif du refus (si saisi) */}
      {isRefused && quote.refusal_reason && (
        <div className="text-xs italic text-[#6B7280] rounded-md px-3 py-2" style={{ ...mFont, backgroundColor: "#fff" }}>
          &ldquo;{quote.refusal_reason}&rdquo;
        </div>
      )}

      {/* Voir le devis */}
      {items.length > 0 && (
        <QuoteViewerButton caterer={catererInfo} data={previewData} />
      )}

      {/* Actions : accepter / refuser / contacter */}
      {canAccept && (
        <>
          <div className="border-t border-[#E5E7EB]" />

          {/* Accepter */}
          <form action={acceptQuoteAction}>
            <input type="hidden" name="quote_id"       value={quote.id} />
            <input type="hidden" name="request_id"     value={requestId} />
            <input type="hidden" name="event_date"     value={eventDate} />
            <input type="hidden" name="event_address"  value={eventAddress} />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#16A34A", ...mFont }}
            >
              <CheckCircle size={13} />
              Accepter ce devis
            </button>
          </form>

          {/* Refuser */}
          <RefuseQuoteButton
            action={refuseQuoteAction}
            quoteId={quote.id}
            requestId={requestId}
          />
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-black" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>{label}</span>
      {value && (
        <span className="text-xs font-bold text-black text-right" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>{value}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#f2f2f2]" />;
}
