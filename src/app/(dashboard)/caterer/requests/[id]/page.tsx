import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Calendar, Euro, Building2, ChevronLeft } from "lucide-react";
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
        companies ( name ),
        users ( first_name, last_name, email )
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
          companies: { name: string } | null;
          users: {
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

  // Fetch existing quote
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

          {/* Page title */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            {request.title}
          </h1>

          {/* Main grid */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left : details card ── */}
            <div
              className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6"
            >
              {/* Status badge */}
              <div>
                <StatusBadge variant={statusVariant} />
              </div>

              {/* Détails de l'événement */}
              <Section title="Détails de l'événement">
                <Row
                  label="Type de prestation"
                  value={
                    (MEAL_TYPE_LABELS[request.meal_type] ?? request.meal_type) +
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

            {/* ── Right : action panel ── */}
            <div
              className="bg-white rounded-lg p-6 flex flex-col gap-6 w-full md:w-[324px] md:shrink-0"
            >
              {/* Company + contact */}
              <div className="flex flex-col gap-2">
                <Building2 size={24} className="text-[#C4714A]" />
                <p
                  className="font-display font-bold text-2xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  {companyName ?? "—"}
                </p>
                {clientName && (
                  <div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-[#313131] w-fit"
                    style={{
                      backgroundColor: "#F5F1E8",
                      fontFamily: "Marianne, system-ui, sans-serif",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {clientName}
                  </div>
                )}
              </div>

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

              {/* CTAs */}
              {isNew && (
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/caterer/requests/${id}/quote/new`}
                    className="flex items-center justify-center px-6 py-4 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: "#1A3A52",
                      fontFamily: "Marianne, system-ui, sans-serif",
                    }}
                  >
                    Accepter et envoyer un devis
                  </Link>
                  <form action={refuseRequest}>
                    <input type="hidden" name="requestId" value={id} />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center px-6 py-4 rounded-full text-xs font-bold text-navy hover:bg-gray-50 transition-colors"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Refuser la demande
                    </button>
                  </form>
                </div>
              )}

              {/* Devis existant (si non nouvelle) */}
              {!isNew && quote && (
                <div className="flex flex-col gap-2">
                  <QuoteSummary quote={quote} />
                </div>
              )}

              {/* Historique avec ce client */}
              <>
                <Divider />
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
              </>
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
    </div>
  );
}
