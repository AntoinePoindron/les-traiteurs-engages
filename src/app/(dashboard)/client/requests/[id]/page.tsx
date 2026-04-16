import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, CheckCircle, Clock, Euro, Users, ShoppingBag } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import QuoteViewerButton from "@/components/caterer/QuoteViewerButton";
import SendMessageButton from "@/components/client/SendMessageButton";
import RefuseQuoteButton from "@/components/client/RefuseQuoteButton";
import type { CatererInfo, PreviewData } from "@/components/caterer/QuotePreviewModal";
import type { QuoteRequestStatus } from "@/types/database";
import { acceptQuoteAction, refuseQuoteAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
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
  | "submitted" | "awaiting_quotes" | "quotes_received"
  | "quote_accepted" | "completed" | "cancelled";

function resolveVariant(
  status: QuoteRequestStatus,
  quotesCount: number,
  hasAccepted: boolean
): ClientBadgeVariant {
  if (status === "cancelled") return "cancelled";
  if (status === "completed" || hasAccepted) return "completed";
  if (quotesCount > 0) return "quotes_received";
  // sent_to_caterers est une étape interne — le client voit juste "Soumise"
  return "submitted";
}


// ── Page ───────────────────────────────────────────────────────

export default async function ClientRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch request (owned by current user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqData } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, title, status, created_at,
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
    .eq("client_user_id", user!.id)
    .single();

  if (!reqData) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = reqData as any;

  // Fetch caterers linked to this request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qrcData } = await (supabase as any)
    .from("quote_request_caterers")
    .select("caterers ( id, name, city, logo_url )")
    .eq("quote_request_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedCaterers: { id: string; name: string; city: string | null; logo_url: string | null }[] =
    (qrcData ?? []).map((r: any) => r.caterers).filter(Boolean);

  // Fetch transmitted quotes avec infos traiteur
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quotesData } = await (supabase as any)
    .from("quotes")
    .select(`
      id, reference, total_amount_ht, amount_per_person,
      valorisable_agefiph, valid_until, notes, details, status, created_at,
      caterers ( id, name, logo_url, city, address, zip_code, siret )
    `)
    .eq("quote_request_id", id)
    .in("status", ["sent", "accepted", "refused"])
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes: any[] = quotesData ?? [];
  const visibleQuotes = quotes.filter((q: any) => q.status !== "refused" || q.status === "accepted");

  // Récupérer les user IDs des traiteurs (pour la messagerie)
  const catererIds = [...new Set(quotes.map((q: any) => q.caterers?.id).filter(Boolean))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererUsersData } = catererIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any).from("users").select("id, caterer_id").in("caterer_id", catererIds)
    : { data: [] };
  const catererUserMap: Record<string, string> = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (catererUsersData ?? []).map((u: any) => [u.caterer_id, u.id])
  );
  const acceptedQuote = quotes.find((q: any) => q.status === "accepted") ?? null;
  const quotesCount = quotes.filter((q: any) => q.status === "sent" || q.status === "accepted").length;

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
    quotesCount,
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
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Back */}
          <BackButton label="Retour" />

          <div className="flex items-start justify-between gap-4">
            <h1
              className="font-display font-bold text-4xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              {request.title}
            </h1>
            <StatusBadge variant={statusVariant} />
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left : détails ── */}
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6">

              {/* Détails événement */}
              <Section title="Détails de l'événement">
                <Row label="Type de prestation" value={serviceLabel + (serviceLabelSecondary ? ` + ${serviceLabelSecondary}` : "")} />
                <Row label="Date" value={eventDate} />
                {(request.event_start_time || request.event_end_time) && (
                  <Row label="Horaires" value={[request.event_start_time, request.event_end_time].filter(Boolean).join(" – ")} />
                )}
                <Row label="Lieu" value={request.event_address} />
                <Row label="Nombre de personnes" value={`${request.guest_count} personnes`} />
                {request.description && (
                  <Row label="Type d'événement" value={request.description} />
                )}
              </Section>

              {/* Boissons */}
              {drinkItems.length > 0 && (
                <>
                  <Divider />
                  <Section title="Boissons">
                    {drinkItems.map((item) => <Row key={item} label={item} />)}
                  </Section>
                </>
              )}

              {/* Services additionnels */}
              {serviceItems.length > 0 && (
                <>
                  <Divider />
                  <Section title="Services additionnels">
                    {serviceItems.map((item, i) => (
                      <Row key={i} label={item.label} value={item.detail} />
                    ))}
                  </Section>
                </>
              )}

              {/* Préférences alimentaires */}
              {(dietItems.length > 0 || request.dietary_other) && (
                <>
                  <Divider />
                  <Section title="Préférences et contraintes alimentaires">
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
                  </Section>
                </>
              )}

              {/* Budget */}
              {(request.budget_global || request.budget_per_person) && (
                <>
                  <Divider />
                  <Section title="Budget">
                    {request.budget_global && (
                      <Row label="Budget total" value={`${Number(request.budget_global).toLocaleString("fr-FR")} €`} />
                    )}
                    {request.budget_per_person && (
                      <Row label="Budget par personne" value={`${Number(request.budget_per_person).toLocaleString("fr-FR")} €`} />
                    )}
                    {request.budget_flexibility && (
                      <Row label="Flexibilité" value={FLEXIBILITY_LABELS[request.budget_flexibility] ?? request.budget_flexibility} />
                    )}
                  </Section>
                </>
              )}

              {/* Message au traiteur */}
              {request.message_to_caterer && (
                <>
                  <Divider />
                  <Section title="Message au traiteur">
                    <p className="text-xs text-black whitespace-pre-wrap italic" style={mFont}>
                      {request.message_to_caterer}
                    </p>
                  </Section>
                </>
              )}
            </div>

            {/* ── Right : traiteur + statut + devis ── */}
            <div className="bg-white rounded-lg p-6 flex flex-col gap-5 w-full md:w-[324px] md:shrink-0">

              {/* 1 — Traiteur contacté (demande directe) — toujours en haut */}
              {!request.is_compare_mode && linkedCaterers.length > 0 && (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                      Traiteur contacté
                    </p>
                    {linkedCaterers.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/client/caterers/${cat.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-[#F3F4F6] hover:border-[#1A3A52]/30 hover:bg-[#F5F1E8] transition-all"
                      >
                        {cat.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.logo_url} alt="" className="h-8 w-auto object-contain shrink-0" />
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
                  <Divider />
                </>
              )}

              {/* 2 — Commande associée (devis accepté) */}
              {linkedOrderId && (
                <>
                  <Link
                    href={`/client/orders/${linkedOrderId}`}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "#1A3A52", fontFamily: "Marianne, system-ui, sans-serif" }}
                  >
                    <ShoppingBag size={15} />
                    Voir la commande
                  </Link>
                  <Divider />
                </>
              )}

              {/* 3 — Demande en cours d'examen (état soumise, pas encore de devis) */}
              {visibleQuotes.length === 0 && statusVariant === "submitted" && (
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
              {visibleQuotes.length > 0 && (
                <>
                  <div className="flex flex-col gap-4">
                    <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                      Devis reçus
                    </p>
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
                        canAccept={!acceptedQuote && quote.status === "sent"}
                        myUserId={user!.id}
                        recipientUserId={catererUserMap[quote.caterers?.id] ?? null}
                      />
                    ))}
                  </div>
                  <Divider />
                </>
              )}

              {/* 5 — Budget résumé */}
              {(request.budget_global || request.budget_per_person) && (
                <div className="flex flex-col gap-3">
                  {request.budget_global && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Euro size={14} className="text-[#6B7280]" />
                        <span className="text-xs text-[#6B7280]" style={mFont}>Budget total</span>
                      </div>
                      <span className="text-sm font-bold text-black" style={mFont}>
                        {Number(request.budget_global).toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  )}
                  {request.budget_per_person && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-[#6B7280]" />
                        <span className="text-xs text-[#6B7280]" style={mFont}>Par personne</span>
                      </div>
                      <span className="text-sm font-bold text-black" style={mFont}>
                        {Number(request.budget_per_person).toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Quote card ─────────────────────────────────────────────────

function QuoteCard({
  quote, requestId, eventDate, eventAddress, guestCount, mealTypeLabel,
  isAccepted, canAccept, myUserId, recipientUserId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote: any;
  requestId: string;
  eventDate: string;
  eventAddress: string;
  guestCount: number;
  mealTypeLabel: string;
  isAccepted: boolean;
  canAccept: boolean;
  myUserId: string;
  recipientUserId: string | null;
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
        backgroundColor: isAccepted ? "#DCFCE7" : "#F5F1E8",
        border: isAccepted ? "1px solid #16A34A40" : "none",
      }}
    >
      {/* Traiteur */}
      <div className="flex items-center gap-2">
        {caterer?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={caterer.logo_url} alt="" className="h-6 w-auto object-contain" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#1A3A52]/10 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-[#1A3A52]" style={mFont}>
              {caterer?.name?.[0] ?? "?"}
            </span>
          </div>
        )}
        <p className="text-xs font-bold text-black truncate" style={mFont}>
          {caterer?.name ?? "Traiteur"}
        </p>
        {isAccepted && (
          <span className="ml-auto text-[10px] font-bold text-[#16A34A]" style={mFont}>Accepté</span>
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

          {/* Envoyer un message */}
          {recipientUserId && (
            <SendMessageButton
              myUserId={myUserId}
              recipientUserId={recipientUserId}
              recipientName={caterer?.name ?? "le traiteur"}
              quoteRequestId={requestId}
            />
          )}
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
