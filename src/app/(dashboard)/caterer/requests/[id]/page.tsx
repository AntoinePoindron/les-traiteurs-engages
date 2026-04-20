import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Calendar, Euro, ChevronLeft, ShoppingBag } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import QuoteViewerButton from "@/components/caterer/QuoteViewerButton";
import ContactCard from "@/components/ui/ContactCard";
import { formatDateTime } from "@/lib/format";
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

type StatusVariant =
  | "new"
  | "pending"
  | "sent"
  | "accepted"
  | "refused"
  | "expired";

function resolveStatusVariant(
  qrcStatus: QuoteRequestCatererStatus,
  quoteStatus?: string | null
): StatusVariant {
  if (qrcStatus === "rejected") return "expired";
  if (qrcStatus === "closed")   return "expired";
  if (qrcStatus === "selected") return "new";
  if (quoteStatus === "accepted") return "accepted";
  if (quoteStatus === "refused") return "refused";
  if (quoteStatus === "expired") return "expired";
  if (qrcStatus === "transmitted_to_client") return "sent";
  return "pending";
}

// ── Server action : refuser la demande ──────────────────────
async function refuseRequest(formData: FormData) {
  "use server";
  const requestId = formData.get("requestId") as string;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quote_request_caterers")
    .update({ status: "rejected" })
    .eq("quote_request_id", requestId)
    .eq("caterer_id", catererId);

  redirect("/caterer/requests");
}

// ── Page ────────────────────────────────────────────────────
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

  // Fetch assignment + full request + company + client user
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
        description, status, created_at,
        companies ( name, logo_url ),
        users ( id, first_name, last_name, email )
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
    quote_requests:
      | (QuoteRequest & {
          companies: { name: string; logo_url: string | null } | null;
          users: {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string;
          } | null;
        })
      | null;
  };

  const assignment = assignmentData as AssignmentRow;
  const request = assignment.quote_requests;
  if (!request) notFound();

  // Fetch existing sent/accepted quote (full details for preview)
  const { data: quoteData } = await supabase
    .from("quotes")
    .select(
      "id, reference, total_amount_ht, amount_per_person, valorisable_agefiph, valid_until, notes, details, status, refusal_reason, created_at"
    )
    .eq("quote_request_id", id)
    .eq("caterer_id", catererId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const quote = quoteData as Quote | null;

  // Commande liée au devis accepté
  let linkedOrderId: string | null = null;
  if (quote?.status === "accepted") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderRef } = await (supabase as any)
      .from("orders")
      .select("id")
      .eq("quote_id", quote.id)
      .maybeSingle();
    linkedOrderId = orderRef?.id ?? null;
  }

  // Fetch draft quote if any
  const { data: draftQuoteData } = await supabase
    .from("quotes")
    .select("id")
    .eq("quote_request_id", id)
    .eq("caterer_id", catererId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const draftQuote = draftQuoteData as { id: string } | null;

  // Fetch caterer info for quote preview
  const { data: catererData } = await supabase
    .from("caterers")
    .select("name, address, city, zip_code, siret, logo_url")
    .eq("id", catererId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = catererData as any;
  const catererInfo = {
    name: c?.name ?? "",
    address: c?.address ?? null,
    city: c?.city ?? null,
    zip_code: c?.zip_code ?? null,
    siret: c?.siret ?? null,
    logo_url: c?.logo_url ?? null,
  };

  // Fetch order history for this caterer + company
  const companyId = (request as { company_id?: string }).company_id;
  type HistoryOrder = {
    id: string;
    delivery_date: string;
    quotes: { total_amount_ht: number; quote_requests: { title: string; company_id: string } | null } | null;
  };
  let history: HistoryOrder[] = [];
  if (companyId) {
    const { data: historyData } = await supabase
      .from("orders")
      .select(`
        id, delivery_date,
        quotes!inner ( total_amount_ht, caterer_id,
          quote_requests!inner ( title, company_id )
        )
      `)
      .eq("quotes.caterer_id", catererId)
      .in("status", ["delivered", "invoiced", "paid"])
      .neq("quotes.quote_requests.id", id)
      .order("delivery_date", { ascending: false })
      .limit(3);

    if (historyData) {
      history = (historyData as unknown as HistoryOrder[]).filter(
        (o) =>
          o.quotes?.quote_requests?.company_id === companyId
      );
    }
  }

  const statusVariant = resolveStatusVariant(assignment.status, quote?.status);

  const eventDate = new Date(request.event_date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const companyName = request.companies?.name;
  const clientUser = request.users;
  const clientName = clientUser
    ? `${clientUser.first_name ?? ""} ${clientUser.last_name ?? ""}`.trim()
    : null;

  // Dietary items
  const dietaryRows: { label: string }[] = [];
  if (request.dietary_vegetarian) dietaryRows.push({ label: "Végétarien" });
  if (request.dietary_vegan) dietaryRows.push({ label: "Végan" });
  if (request.dietary_halal) dietaryRows.push({ label: "Halal" });
  if (request.dietary_kosher) dietaryRows.push({ label: "Kasher" });
  if (request.dietary_gluten_free) dietaryRows.push({ label: "Sans gluten" });

  const showDrinks =
    request.drinks_included || Boolean(request.drinks_details);
  const showServices =
    request.service_waitstaff ||
    request.service_equipment ||
    request.service_decoration ||
    Boolean(request.service_other);
  const showDietary = dietaryRows.length > 0 || Boolean(request.dietary_other);
  const showMessage = Boolean(request.description);

  const isNew = assignment.status === "selected";
  const isClosed = assignment.status === "closed";

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
          <BackButton label="Retour" />

          {/* Page title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {request.title}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                Créée le {formatDateTime(request.created_at)}
              </p>
            </div>
            <StatusBadge variant={statusVariant} />
          </div>

          {isClosed && (
            <div
              className="rounded-lg p-4 flex items-start gap-3 border-l-4"
              style={{ backgroundColor: "#FEF2F2", borderLeftColor: "#B91C1C" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold" style={{ color: "#991B1B", fontFamily: "Marianne, system-ui, sans-serif" }}>
                  Demande clôturée
                </p>
                <p className="text-xs" style={{ color: "#991B1B", fontFamily: "Marianne, system-ui, sans-serif" }}>
                  Le client a reçu 3 devis avant votre réponse. Vous ne pouvez plus proposer de devis sur cette demande.
                </p>
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left : details card ── */}
            <div
              className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6"
            >

              {/* Détails de l'événement */}
              <Section title="Détails de l'événement">
                <Row
                  label="Type de prestation"
                  value={
                    (MEAL_TYPE_LABELS[request.meal_type ?? ""] ?? request.meal_type) +
                    (request.is_full_day && request.meal_type_secondary
                      ? ` + ${MEAL_TYPE_LABELS[request.meal_type_secondary] ?? request.meal_type_secondary}`
                      : "")
                  }
                />
                <Row label="Date" value={eventDate} />
                {(request.event_start_time || request.event_end_time) && (
                  <Row
                    label="Horaires"
                    value={[request.event_start_time, request.event_end_time]
                      .filter(Boolean)
                      .join(" - ")}
                  />
                )}
                <Row label="Lieu" value={request.event_address} />
                <Row
                  label="Nombre de personnes"
                  value={`${request.guest_count} personnes`}
                />
              </Section>

              {/* Boissons */}
              {showDrinks && (
                <>
                  <Divider />
                  <Section title="Boissons">
                    {request.drinks_details ? (
                      request.drinks_details
                        .split(/[,\n]+/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((item, i) => <Row key={i} label={item} />)
                    ) : (
                      <Row label="Boissons incluses" />
                    )}
                  </Section>
                </>
              )}

              {/* Services additionnels */}
              {showServices && (
                <>
                  <Divider />
                  <Section title="Services additionnels">
                    {request.service_waitstaff && <Row label="Personnel" />}
                    {request.service_equipment && (
                      <Row label="Matériel" value={request.service_other ?? undefined} />
                    )}
                    {request.service_decoration && <Row label="Décoration" />}
                    {request.service_other && !request.service_equipment && (
                      <Row label="Autre" value={request.service_other} />
                    )}
                  </Section>
                </>
              )}

              {/* Contraintes alimentaires */}
              {showDietary && (
                <>
                  <Divider />
                  <Section title="Préférences et contraintes alimentaires">
                    {dietaryRows.map((row) => (
                      <Row key={row.label} label={row.label} />
                    ))}
                    {request.dietary_other && (
                      <Row label="Autre" value={request.dietary_other} />
                    )}
                  </Section>
                </>
              )}

              {/* Message du client */}
              {showMessage && (
                <>
                  <Divider />
                  <Section title="Message du client">
                    <p
                      className="text-xs text-black whitespace-pre-wrap italic"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {request.description}
                    </p>
                  </Section>
                </>
              )}
            </div>

            {/* ── Right : client card + action panel ── */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              {/* Bloc demande : budget + CTAs — concerne l'objet */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-6">
              {/* Budget */}
              <div className="flex flex-col gap-4">
                {request.budget_global != null && (
                  <Row
                    label="Budget total"
                    value={`${request.budget_global.toLocaleString("fr-FR")} €`}
                  />
                )}
                {request.budget_per_person != null && (
                  <Row
                    label="Budget par personne"
                    value={`${request.budget_per_person.toLocaleString("fr-FR")} €`}
                  />
                )}
              </div>

              {/* CTAs (style harmonisé avec le client) */}
              {isNew && (
                <div className="flex flex-col gap-2">
                  {draftQuote ? (
                    <>
                      <Link
                        href={`/caterer/requests/${id}/quote/${draftQuote.id}/edit`}
                        className="w-full flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
                        style={{
                          backgroundColor: "#1A3A52",
                          fontFamily: "Marianne, system-ui, sans-serif",
                        }}
                      >
                        Reprendre le brouillon
                      </Link>
                      <Link
                        href={`/caterer/requests/${id}/quote/new`}
                        className="w-full flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                      >
                        Créer un nouveau devis
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/caterer/requests/${id}/quote/new`}
                      className="w-full flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: "#1A3A52",
                        fontFamily: "Marianne, system-ui, sans-serif",
                      }}
                    >
                      Accepter et envoyer un devis
                    </Link>
                  )}
                  <form action={refuseRequest}>
                    <input type="hidden" name="requestId" value={id} />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#DC2626] hover:bg-[#FFF5F5] transition-colors"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Refuser la demande
                    </button>
                  </form>
                </div>
              )}

              {/* Devis existant (si non nouvelle) */}
              {!isNew && quote && (() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const q = quote as any;
                const items: {
                  id: string;
                  label: string;
                  description: string;
                  quantity: number;
                  unit_price_ht: number;
                  tva_rate: number;
                  section: "main" | "drinks" | "extra";
                }[] = (q.details ?? []).map(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (d: any, i: number) => ({
                    id: String(i),
                    label: d.label ?? "",
                    description: d.description ?? "",
                    quantity: d.quantity ?? 1,
                    unit_price_ht: d.unit_price_ht ?? 0,
                    tva_rate: d.tva_rate ?? 10,
                    section: d.section ?? "main",
                  })
                );
                const tvaMap: Record<number, number> = {};
                for (const item of items) {
                  const ht = item.quantity * item.unit_price_ht;
                  tvaMap[item.tva_rate] = (tvaMap[item.tva_rate] ?? 0) + (ht * item.tva_rate) / 100;
                }
                const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
                const previewData = {
                  reference: q.reference ?? "",
                  validUntil: q.valid_until ?? "",
                  notes: q.notes ?? "",
                  items,
                  totalHT: q.total_amount_ht ?? 0,
                  tvaMap,
                  totalTVA,
                  totalTTC: (q.total_amount_ht ?? 0) + totalTVA,
                  guestCount: request.guest_count,
                  eventDate: request.event_date,
                  eventAddress: request.event_address,
                  mealTypeLabel: MEAL_TYPE_LABELS[request.meal_type ?? ""] ?? request.meal_type,
                };
                return (
                  <div className="flex flex-col gap-3">
                    <QuoteSummary quote={quote}>
                      <QuoteViewerButton caterer={catererInfo} data={previewData} />
                    </QuoteSummary>

                    {/* Motif de refus saisi par le client */}
                    {quote.status === "refused" && quote.refusal_reason && (
                      <div
                        className="flex flex-col gap-2 p-3 rounded-lg border border-[#DC2626]/30"
                        style={{ backgroundColor: "#FFF5F5" }}
                      >
                        <p
                          className="text-xs font-bold text-[#DC2626]"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          Motif du refus
                        </p>
                        <p
                          className="text-xs text-black whitespace-pre-wrap italic"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {quote.refusal_reason}
                        </p>
                      </div>
                    )}

                    {linkedOrderId && (
                      <Link
                        href={`/caterer/orders/${linkedOrderId}`}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                      >
                        <ShoppingBag size={13} />
                        Voir la commande
                      </Link>
                    )}
                  </div>
                );
              })()}

              </div>

              {/* Carte client */}
              <ContactCard
                entityType="client"
                entityName={companyName ?? null}
                entityLogoUrl={request.companies?.logo_url ?? null}
                contactUserId={clientUser?.id ?? null}
                contactFirstName={clientUser?.first_name ?? null}
                contactLastName={clientUser?.last_name ?? null}
                contactEmail={clientUser?.email ?? null}
                myUserId={user!.id}
                quoteRequestId={id}
                messagesHref="/caterer/messages"
              />

              {/* Historique avec ce client — contexte client */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-6">
                  <p
                    className="font-display font-bold text-xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Historique avec ce client
                  </p>
                  {history.length === 0 ? (
                    <p
                      className="text-xs text-[#313131]"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Aucune commande précédente.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {history.map((o) => (
                        <div key={o.id} className="flex flex-col gap-3">
                          <p
                            className="text-xs font-bold text-black"
                            style={{
                              fontFamily: "Marianne, system-ui, sans-serif",
                            }}
                          >
                            {o.quotes?.quote_requests?.title ?? "Commande"}
                          </p>
                          <div className="flex items-center gap-1">
                            <Calendar size={16} className="text-[#313131]" />
                            <span
                              className="text-xs text-[#313131]"
                              style={{
                                fontFamily: "Marianne, system-ui, sans-serif",
                              }}
                            >
                              {new Date(o.delivery_date).toLocaleDateString(
                                "fr-FR"
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Euro size={16} className="text-[#313131]" />
                            <span
                              className="text-xs text-[#313131]"
                              style={{
                                fontFamily: "Marianne, system-ui, sans-serif",
                              }}
                            >
                              {o.quotes?.total_amount_ht.toLocaleString(
                                "fr-FR"
                              )}{" "}
                              €
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p
        className="font-display font-bold text-xl text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className="text-xs text-black"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {label}
      </span>
      {value && (
        <span
          className="text-xs font-bold text-black text-right"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#f2f2f2]" />;
}

function QuoteSummary({ quote, children }: { quote: Quote; children?: React.ReactNode }) {
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
        <Row
          label="Montant HT"
          value={`${quote.total_amount_ht.toLocaleString("fr-FR")} €`}
        />
        {quote.amount_per_person != null && (
          <Row
            label="Par personne"
            value={`${quote.amount_per_person.toLocaleString("fr-FR")} €`}
          />
        )}
        {quote.valorisable_agefiph != null && (
          <Row
            label="Valorisable AGEFIPH"
            value={`${quote.valorisable_agefiph.toLocaleString("fr-FR")} €`}
          />
        )}
        {quote.valid_until && (
          <Row
            label="Valide jusqu'au"
            value={new Date(quote.valid_until).toLocaleDateString("fr-FR")}
          />
        )}
      </div>
      {children}
    </div>
  );
}
