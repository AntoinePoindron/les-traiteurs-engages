import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import { Section, InfoRow, KpiCard } from "@/components/admin/DetailPageAtoms";
import MessageUserButton from "@/components/admin/MessageUserButton";
import type { Caterer, ServiceTypeConfig } from "@/types/database";
import { validateCatererAction, rejectCatererAction } from "../actions";
import {
  MapPin, Truck, Users, CheckCircle, Clock, ChefHat,
  Euro, Percent, FileText, ShoppingBag, Hash, Utensils,
} from "lucide-react";

// Never serve from cache — orders / requests change continuously.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_LABELS: Record<string, string> = {
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

const DIET_LABELS = [
  { key: "dietary_vegetarian" as keyof Caterer, label: "Végétarien" },
  { key: "dietary_halal"       as keyof Caterer, label: "Halal" },
  { key: "dietary_gluten_free" as keyof Caterer, label: "Sans gluten" },
  { key: "dietary_bio"         as keyof Caterer, label: "Bio" },
];

const ACTIVE_ORDER_STATUSES = ["confirmed", "delivered"];
const COMPLETED_ORDER_STATUSES = ["confirmed", "delivered", "invoiced", "paid"];

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function AdminCatererDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Current admin (for messaging)
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const adminUserId = adminUser!.id;

  const { data } = await supabase
    .from("caterers")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const caterer = data as Caterer;

  // ── Contacts (users linked to this caterer) ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contactsRaw } = await (supabase as any)
    .from("users")
    .select("id, first_name, last_name, email, created_at")
    .eq("caterer_id", id);

  const contacts = (contactsRaw ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    created_at: string;
  }[];

  // ── KPIs : orders and quote_requests ────────────────────────
  const [
    quoteRequestMatches,
    orders,
    acceptedQuotes,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("quote_request_caterers")
      .select("id", { count: "exact", head: true })
      .eq("caterer_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("orders")
      .select("id, status, quotes!inner(caterer_id)")
      .eq("quotes.caterer_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("quotes")
      .select("total_amount_ht")
      .eq("caterer_id", id)
      .eq("status", "accepted"),
  ]);

  const requestsReceived = quoteRequestMatches.count ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersRows = (orders.data ?? []) as any[];
  const activeOrdersCount = ordersRows.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;
  const totalOrdersCount = ordersRows.filter((o) => COMPLETED_ORDER_STATUSES.includes(o.status)).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caGenerated = (acceptedQuotes.data ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, q: any) => sum + Number(q.total_amount_ht ?? 0),
    0
  );

  // ── Services proposés ───────────────────────────────────────
  const serviceConfig = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;
  const enabledServices = Object.entries(serviceConfig)
    .filter(([, cfg]) => cfg.enabled)
    .map(([key, cfg]) => ({ key, label: SERVICE_LABELS[key] ?? key, cfg }));

  const activeDiets = DIET_LABELS.filter(({ key }) => caterer[key]);

  // Formatted strings for InfoRow
  const addressValue = (caterer.address || caterer.city)
    ? [caterer.address, [caterer.zip_code, caterer.city].filter(Boolean).join(" ")]
        .filter(Boolean).join(" · ")
    : null;
  const deliveryValue = caterer.delivery_radius_km
    ? `${caterer.delivery_radius_km} km`
    : null;
  const capacityValue = (caterer.capacity_min || caterer.capacity_max)
    ? (caterer.capacity_min && caterer.capacity_max
        ? `${caterer.capacity_min} à ${caterer.capacity_max} personnes`
        : caterer.capacity_min
          ? `À partir de ${caterer.capacity_min} personnes`
          : `Jusqu'à ${caterer.capacity_max} personnes`)
    : null;

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton label="Retour" />

          {/* ── Header ── */}
          <div className="flex items-center gap-4">
            {caterer.logo_url ? (
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white shadow-sm flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={caterer.logo_url} alt="" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#E5EDF2" }}>
                <ChefHat size={22} style={{ color: "#1A3A52" }} />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {caterer.name}
              </h1>
              <p className="text-sm text-[#6B7280] mt-1" style={mFont}>
                {[caterer.city, `Inscrit le ${formatDate(caterer.created_at)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          {/* ── Grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">

            {/* ══ Colonne gauche : Infos + Contact ══ */}
            <div className="flex flex-col gap-6">

              {/* Informations */}
              <Section title="Informations">
                <div className="flex flex-wrap gap-1.5">
                  {caterer.is_validated ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                    >
                      <CheckCircle size={10} />
                      Compte validé
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "#FFF3CD", color: "#B45309", ...mFont }}
                    >
                      <Clock size={10} />
                      En attente
                    </span>
                  )}
                  {caterer.esat_status && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                    >
                      ESAT
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-3 border-t border-[#F3F4F6]">
                  <InfoRow icon={Hash}     label="SIRET"      value={caterer.siret} />
                  <InfoRow icon={MapPin}   label="Adresse"    value={addressValue} />
                  <InfoRow icon={Truck}    label="Livraison"  value={deliveryValue} />
                  <InfoRow icon={Users}    label="Capacité"   value={capacityValue} />
                  <InfoRow
                    icon={Percent}
                    label="Commission"
                    value={caterer.commission_rate != null ? `${caterer.commission_rate} %` : null}
                  />
                </div>

                {activeDiets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeDiets.map(({ label }) => (
                      <span
                        key={label}
                        className="px-2 py-1 rounded text-[11px] font-bold"
                        style={{ ...mFont, backgroundColor: "#DCFCE7", color: "#16A34A" }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {caterer.description && (
                  <div className="pt-3 border-t border-[#F3F4F6]">
                    <p className="text-xs text-[#444] leading-relaxed" style={mFont}>
                      {caterer.description}
                    </p>
                  </div>
                )}
              </Section>

              {/* Contact(s) */}
              {contacts.length > 0 && (
                <Section title={contacts.length > 1 ? `Contacts (${contacts.length})` : "Contact"}>
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {contacts.map((c) => {
                      const name =
                        `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email;
                      const initial = name.slice(0, 1).toUpperCase();
                      return (
                        <div key={c.id} className="flex items-center justify-between py-2.5 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                              style={{ backgroundColor: "#1A3A52", ...mFont }}
                            >
                              {initial}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-sm font-bold text-black truncate" style={mFont}>{name}</p>
                              <p className="text-xs text-[#6B7280] truncate" style={mFont}>{c.email}</p>
                            </div>
                          </div>
                          {c.id !== adminUserId && (
                            <MessageUserButton recipientUserId={c.id} variant="icon" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Actions admin */}
              <Section title="Actions admin">
                {caterer.is_validated ? (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#DCFCE7" }}>
                      <CheckCircle size={15} style={{ color: "#16A34A" }} />
                      <p className="text-xs font-bold" style={{ color: "#16A34A", ...mFont }}>
                        Ce compte est validé
                      </p>
                    </div>
                    <form action={rejectCatererAction}>
                      <input type="hidden" name="caterer_id" value={caterer.id} />
                      <button
                        type="submit"
                        className="w-full px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors"
                        style={mFont}
                      >
                        Désactiver ce compte
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#FFF3CD" }}>
                      <Clock size={15} style={{ color: "#B45309" }} />
                      <p className="text-xs font-bold" style={{ color: "#B45309", ...mFont }}>
                        En attente de validation
                      </p>
                    </div>
                    <form action={validateCatererAction}>
                      <input type="hidden" name="caterer_id" value={caterer.id} />
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#1A3A52", ...mFont }}
                      >
                        <CheckCircle size={16} />
                        Valider ce compte
                      </button>
                    </form>
                    <form action={rejectCatererAction}>
                      <input type="hidden" name="caterer_id" value={caterer.id} />
                      <button
                        type="submit"
                        className="w-full px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors"
                        style={mFont}
                      >
                        Refuser ce compte
                      </button>
                    </form>
                  </>
                )}
              </Section>
            </div>

            {/* ══ Colonne droite : Activité ══ */}
            <div className="flex flex-col gap-6">

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon={FileText}    label="Demandes reçues"  value={String(requestsReceived)} />
                <KpiCard icon={ShoppingBag} label="Commandes actives" value={String(activeOrdersCount)} />
                <KpiCard icon={CheckCircle} label="Commandes totales" value={String(totalOrdersCount)} />
                <KpiCard icon={Euro}        label="CA généré" value={caGenerated > 0 ? `${formatMoney(caGenerated)} €` : "—"} />
              </div>

              {/* Types de prestations */}
              {enabledServices.length > 0 && (
                <Section title="Types de prestations">
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {enabledServices.map(({ key, label, cfg }) => (
                      <div key={key} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Utensils size={14} className="text-[#9CA3AF] shrink-0" />
                          <p className="text-sm font-bold text-black truncate" style={mFont}>{label}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#6B7280] shrink-0" style={mFont}>
                          {cfg.capacity_min && (
                            <span>{cfg.capacity_min}–{cfg.capacity_max ?? "∞"} pers</span>
                          )}
                          {cfg.price_per_person_min && (
                            <span className="font-bold text-[#1A3A52]">
                              {cfg.price_per_person_min} €/pers
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Photos */}
              {caterer.photos && caterer.photos.length > 0 && (
                <Section title={`Photos (${caterer.photos.length})`}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {caterer.photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-full aspect-video object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
