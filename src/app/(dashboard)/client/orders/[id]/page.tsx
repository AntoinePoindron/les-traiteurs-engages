import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrendingUp, FileText, CreditCard, CheckCircle, Info, Calendar, MapPin, Users, Clock, Truck, ExternalLink } from "lucide-react";
import DownloadInvoiceButton from "@/components/client/DownloadInvoiceButton";
import BankTransferCard from "@/components/client/BankTransferCard";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import { formatDateTime } from "@/lib/format";
import { dismissNotifications } from "@/lib/notifications";
import { getBankTransferInstructions } from "@/lib/stripe/bank-transfer";
import {
  PLATFORM_FEE_LABEL,
  PLATFORM_FEE_RATE_DISPLAY,
  PLATFORM_FEE_TVA_RATE,
  computePlatformFeeHt,
  computePlatformFeeTva,
  computePlatformFeeTtc,
  deriveInvoiceReference,
} from "@/lib/stripe/constants";
import type { OrderStatus } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// Stepper côté client : 4 étapes.
// - "À venir"          : commande confirmée, pas encore livrée
// - "À payer"          : livrée/facturée, pas encore réglée
// - "Virement en cours" : le client a déclaré avoir émis un virement,
//                         on attend la confirmation Stripe (1-3 j)
// - "Payée"            : webhook invoice.paid reçu
//
// "Virement en cours" est un **pseudo-statut** (pas une colonne DB) —
// il est dérivé de `bank_transfer_declared_at` sur une commande dont
// le statut DB est encore `delivered`/`invoiced`. La source de vérité
// pour "Payée" reste le statut DB `paid` (via webhook Stripe).
type StepKey = OrderStatus | "bank_transfer_pending";

const ORDER_STATUS_STEPS: { key: StepKey; label: string }[] = [
  { key: "confirmed",              label: "À venir" },
  { key: "invoiced",               label: "À payer" },
  { key: "bank_transfer_pending",  label: "Virement en cours" },
  { key: "paid",                   label: "Payée" },
];

const ORDER_STATUS_VARIANT: Record<OrderStatus, "confirmed" | "invoiced" | "paid" | "disputed"> = {
  confirmed:  "confirmed",
  // `delivered` partage le même variant visuel que `invoiced` côté
  // client (bleu, libellé "À payer" via customLabel).
  delivered:  "invoiced",
  invoiced:   "invoiced",
  paid:       "paid",
  disputed:   "disputed",
};

function clientStatusLabel(
  status: OrderStatus,
  bankTransferDeclaredAt: string | null = null,
): string | undefined {
  if (status === "delivered" || status === "invoiced") {
    // Si le client a déclaré son virement, on reflète le délai SEPA
    // via un libellé spécifique (badge jaune via clientStatusVariant).
    if (bankTransferDeclaredAt) return "Virement en cours";
    return "À payer";
  }
  return undefined;
}

/**
 * Variant du badge : en temps normal on utilise ORDER_STATUS_VARIANT.
 * Exception "Virement en cours" → on bascule sur `pending` (jaune)
 * pour signaler visuellement que la commande est en attente côté
 * paiement, distinct de l'état normal "À payer" (bleu).
 */
function clientStatusVariant(
  status: OrderStatus,
  bankTransferDeclaredAt: string | null = null,
): "confirmed" | "invoiced" | "paid" | "disputed" | "pending" {
  if (
    bankTransferDeclaredAt &&
    (status === "delivered" || status === "invoiced")
  ) {
    return "pending";
  }
  return ORDER_STATUS_VARIANT[status];
}

const SECTION_LABELS: Record<string, string> = {
  main:   "Prestations",
  drinks: "Boissons",
  extra:  "Services additionnels",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}

// ── Page ───────────────────────────────────────────────────────

export default async function ClientOrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { payment: paymentFlag } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Dismissal contextuel ──
  // Client qui consulte sa commande : on dégage les notifs "prestation
  // livrée" et "facture émise" liées à cette commande, peu importe
  // comment il est arrivé ici.
  if (user) {
    await dismissNotifications({
      userId: user.id,
      types: ["order_delivered", "invoice_issued"],
      entityId: id,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address, notes, created_at, updated_at,
      stripe_invoice_id, stripe_hosted_invoice_url,
      bank_transfer_declared_at,
      quotes!inner (
        id, reference, total_amount_ht, amount_per_person, valorisable_agefiph,
        valid_until, notes, details,
        caterers ( id, name, city, address, zip_code, logo_url, siret ),
        quote_requests (
          id, title, event_date, event_start_time, event_end_time,
          event_address, guest_count, service_type, meal_type,
          company_service_id, client_user_id,
          company_services ( name )
        )
      )
    `)
    .eq("id", id)
    // L'accès est géré par la RLS (créateur de la commande OU admin de la company)
    .single();

  if (!orderRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderRaw as any;
  const hasStripeInvoice = !!order.stripe_invoice_id;
  const hostedInvoiceUrl: string | null = order.stripe_hosted_invoice_url ?? null;
  const quote = order.quotes;
  const caterer = quote?.caterers;
  const qr = quote?.quote_requests;

  // Thread de conversation lié à cette demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: threadMsg } = await (supabase as any)
    .from("messages")
    .select("thread_id")
    .eq("quote_request_id", qr?.id ?? "")
    .limit(1)
    .maybeSingle();
  const threadId: string | null = threadMsg?.thread_id ?? null;

  // User du traiteur (pour permettre l'envoi direct via la modale
  // + afficher le contact dans la carte traiteur)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererUserRow } = await (supabase as any)
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("caterer_id", caterer?.id ?? "")
    .limit(1)
    .maybeSingle();
  const catererUser = catererUserRow as
    | { id: string; first_name: string | null; last_name: string | null; email: string }
    | null;
  const catererUserId: string | null = catererUser?.id ?? null;

  // Lignes du devis groupées par section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(quote?.details) ? quote.details : [];
  const sections = ["main", "drinks", "extra"] as const;
  const grouped = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sections.map((s) => [s, items.filter((i: any) => (i.section ?? "main") === s)])
  );

  // Calcul TVA
  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const tva = item.tva_rate ?? 0;
    const lineHT = (item.quantity ?? 0) * (item.unit_price_ht ?? 0);
    tvaMap[tva] = (tvaMap[tva] ?? 0) + lineHT * (tva / 100);
  }
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
  const totalHT = Number(quote?.total_amount_ht ?? 0);
  const totalTTC = totalHT + totalTVA;

  // Frais de mise en relation — ajoutés en sus du devis traiteur.
  const feeHt  = computePlatformFeeHt(totalHT);
  const feeTva = computePlatformFeeTva(totalHT);
  const feeTtc = computePlatformFeeTtc(totalHT);
  const grandTotalTtc = totalTTC + feeTtc;

  const eventDate = qr?.event_date
    ? new Date(qr.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const deliveryDate = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Détermine l'étape active de la timeline en combinant le statut DB
  // et la présence (ou non) de `bank_transfer_declared_at`.
  //   - paid                                     → "Payée"
  //   - delivered/invoiced + virement déclaré    → "Virement en cours"
  //   - delivered/invoiced sans déclaration      → "À payer"
  //   - confirmed                                → "À venir"
  // `disputed` n'est pas dans les steps — on retombe sur -1 et le
  // stepper n'a aucune étape active (acceptable, cas marginal).
  const currentStepKey: StepKey = (() => {
    if (order.status === "paid") return "paid";
    if (order.status === "delivered" || order.status === "invoiced") {
      return order.bank_transfer_declared_at ? "bank_transfer_pending" : "invoiced";
    }
    return order.status;
  })();
  const currentStepIdx = ORDER_STATUS_STEPS.findIndex((s) => s.key === currentStepKey);

  // ── État paiement ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentsRaw } = await (supabase as any)
    .from("payments")
    .select("id, status, amount_total_cents, succeeded_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const paymentsList = (paymentsRaw ?? []) as Array<{
    id: string;
    status: string;
    amount_total_cents: number;
    succeeded_at: string | null;
  }>;
  const hasSucceededPayment =
    order.status === "paid" || paymentsList.some((p) => p.status === "succeeded");
  // Payable = facture émise, pas encore payée. Le paiement se fait
  // directement sur la hosted invoice page Stripe (carte ou virement).
  const isOrderPayable = hasStripeInvoice && !hasSucceededPayment;

  // ── Coordonnées bancaires pour virement (si commande payable) ──
  // On fetche à la demande les funding instructions de Stripe pour
  // afficher l'IBAN/BIC virtuel directement sur la page. Idempotent
  // côté Stripe (même customer → même IBAN). On récupère le customer
  // id du client qui a créé la demande (c'est lui qui est customer
  // Stripe).
  let bankInstructions: Awaited<ReturnType<typeof getBankTransferInstructions>> | null = null;
  if (isOrderPayable) {
    // Le customer Stripe est celui du user qui a créé la demande
    // initiale. On le remonte via quote.quote_requests.client_user_id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestUserId: string | null = (qr as any)?.client_user_id ?? null;
    if (requestUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userRow } = await (supabase as any)
        .from("users")
        .select("stripe_customer_id")
        .eq("id", requestUserId)
        .maybeSingle();
      const stripeCustomerId = (userRow as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
      if (stripeCustomerId) {
        bankInstructions = await getBankTransferInstructions(stripeCustomerId);
      }
    }
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Back */}
          <BackButton label="Retour" />

          {/* Titre */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {qr?.title ?? "Commande"}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={mFont}>
                Créée le {formatDateTime(order.created_at)}
                {order.updated_at &&
                  new Date(order.updated_at).getTime() -
                    new Date(order.created_at).getTime() >
                    60_000 && (
                    <>
                      {" · "}
                      <span>Mise à jour le {formatDateTime(order.updated_at)}</span>
                    </>
                  )}
              </p>
              {quote?.reference && (
                <p className="text-sm text-[#9CA3AF]" style={mFont}>
                  Devis {quote.reference}
                  {hasStripeInvoice && deriveInvoiceReference(quote.reference) && (
                    <> · Facture {deriveInvoiceReference(quote.reference)}</>
                  )}
                </p>
              )}
              {qr?.company_services?.name && (
                <p className="text-sm text-[#6B7280] mt-1" style={mFont}>
                  Service : {qr.company_services.name}
                </p>
              )}
            </div>
            <StatusBadge
              variant={clientStatusVariant(
                order.status as OrderStatus,
                order.bank_transfer_declared_at ?? null,
              )}
              customLabel={clientStatusLabel(
                order.status as OrderStatus,
                order.bank_transfer_declared_at ?? null,
              )}
            />
          </div>

          {/* Bannière retour Stripe */}
          {paymentFlag === "success" && (
            <div
              className="bg-white rounded-lg p-4 border-l-4 flex items-start gap-3"
              style={{ borderLeftColor: "#16A34A" }}
            >
              <CheckCircle size={18} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-black" style={mFont}>Paiement envoyé</p>
                <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>
                  Votre règlement a bien été initié. Le statut sera mis à jour dès confirmation par Stripe
                  (quelques secondes).
                </p>
              </div>
            </div>
          )}
          {paymentFlag === "cancelled" && (
            <div
              className="bg-white rounded-lg p-4 border-l-4 flex items-start gap-3"
              style={{ borderLeftColor: "#F59E0B" }}
            >
              <Info size={18} style={{ color: "#B45309" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-black" style={mFont}>Paiement annulé</p>
                <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>
                  Vous pouvez retenter le paiement à tout moment tant que la commande n&apos;est pas réglée.
                </p>
              </div>
            </div>
          )}

          {/* Progression */}
          {order.status !== "disputed" && (
            <div className="bg-white rounded-lg p-6">
              <p className="text-xs font-bold text-black mb-4" style={mFont}>
                Progression de la commande
              </p>
              <div className="flex items-center gap-0">
                {ORDER_STATUS_STEPS.map((step, idx) => {
                  const isDone    = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: isDone ? "#1A3A52" : "#F3F4F6",
                            color: isDone ? "#FFFFFF" : "#9CA3AF",
                            outline: isCurrent ? "2px solid #1A3A52" : "none",
                            outlineOffset: "2px",
                          }}
                        >
                          {idx + 1}
                        </div>
                        <p
                          className="text-[10px] text-center whitespace-nowrap"
                          style={{ color: isDone ? "#1A3A52" : "#9CA3AF", fontWeight: isCurrent ? 700 : 400, ...mFont }}
                        >
                          {step.label}
                        </p>
                      </div>
                      {idx < ORDER_STATUS_STEPS.length - 1 && (
                        <div
                          className="flex-1 h-0.5 mb-5"
                          style={{ backgroundColor: idx < currentStepIdx ? "#1A3A52" : "#F3F4F6" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* Colonne gauche : détail devis */}
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6">

              {/* Lignes par section */}
              {items.length > 0 ? (
                sections.map((section) => {
                  const sectionItems = grouped[section];
                  if (sectionItems.length === 0) return null;
                  return (
                    <div key={section} className="flex flex-col gap-3">
                      <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide" style={mFont}>
                        {SECTION_LABELS[section]}
                      </p>

                      {/* En-tête colonnes */}
                      <div className="grid text-[10px] font-bold text-[#9CA3AF] pb-1 border-b border-[#F3F4F6]" style={{ gridTemplateColumns: "1fr auto auto auto", gap: "8px", ...mFont }}>
                        <span>Désignation</span>
                        <span className="text-right">Qté</span>
                        <span className="text-right w-20">PU HT</span>
                        <span className="text-right w-20">Total HT</span>
                      </div>

                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {sectionItems.map((item: any, idx: number) => {
                        const lineHT = (item.quantity ?? 0) * (item.unit_price_ht ?? 0);
                        return (
                          <div
                            key={idx}
                            className="grid items-start"
                            style={{ gridTemplateColumns: "1fr auto auto auto", gap: "8px" }}
                          >
                            <div>
                              <p className="text-xs font-bold text-black" style={mFont}>{item.label}</p>
                              {item.description && (
                                <p className="text-[11px] text-[#9CA3AF] mt-0.5" style={mFont}>{item.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-[#6B7280] text-right pt-0.5" style={mFont}>{item.quantity}</span>
                            <span className="text-xs text-[#6B7280] text-right w-20 pt-0.5" style={mFont}>
                              {Number(item.unit_price_ht ?? 0).toLocaleString("fr-FR")} €
                            </span>
                            <span className="text-xs font-bold text-black text-right w-20 pt-0.5" style={mFont}>
                              {lineHT.toLocaleString("fr-FR")} €
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[#9CA3AF] italic" style={mFont}>Détail du devis non disponible.</p>
              )}

              {/* Totaux — ventilation prestation / frais plateforme, puis
                  total à payer. Pas de "Total TTC" intermédiaire pour éviter
                  toute confusion avec le grand total final. */}
              {items.length > 0 && (
                <>
                  <div className="border-t border-[#F3F4F6]" />
                  <div className="flex flex-col gap-3">

                    {/* Bloc prestation traiteur */}
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                        Prestation traiteur
                      </p>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6B7280]" style={mFont}>Total HT</span>
                        <span className="text-xs text-black" style={mFont}>
                          {totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      {Object.entries(tvaMap).map(([rate, amount]) => (
                        <div key={rate} className="flex justify-between">
                          <span className="text-xs text-[#6B7280]" style={mFont}>TVA {rate} %</span>
                          <span className="text-xs text-[#6B7280]" style={mFont}>
                            {amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</span>
                        <span className="text-xs font-bold text-black" style={mFont}>
                          {totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                    </div>

                    {/* Bloc frais de mise en relation */}
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                        {PLATFORM_FEE_LABEL} ({Math.round(PLATFORM_FEE_RATE_DISPLAY * 100)}% ajoutés)
                      </p>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6B7280]" style={mFont}>Montant HT</span>
                        <span className="text-xs text-black" style={mFont}>
                          {feeHt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6B7280]" style={mFont}>TVA {PLATFORM_FEE_TVA_RATE} %</span>
                        <span className="text-xs text-[#6B7280]" style={mFont}>
                          {feeTva.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</span>
                        <span className="text-xs font-bold text-black" style={mFont}>
                          {feeTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                    </div>

                    {/* Total à payer */}
                    <div className="flex justify-between pt-3 border-t-2 border-[#1A3A52]">
                      <span className="text-sm font-bold text-black" style={mFont}>Total à payer</span>
                      <span className="text-base font-bold text-[#1A3A52]" style={mFont}>
                        {grandTotalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                    {quote?.amount_per_person != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-[#9CA3AF]" style={mFont}>Soit par personne (prestation)</span>
                        <span className="text-xs text-[#9CA3AF]" style={mFont}>
                          {Number(quote.amount_per_person).toLocaleString("fr-FR")} € HT
                        </span>
                      </div>
                    )}
                    {quote?.valorisable_agefiph != null && (
                      <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "#F0F4F7" }}>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#1A3A52]" style={mFont}>
                          <TrendingUp size={12} />
                          Valorisable AGEFIPH
                        </span>
                        <span className="text-xs font-bold text-[#1A3A52]" style={mFont}>
                          {Number(quote.valorisable_agefiph).toLocaleString("fr-FR")} €
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Notes du traiteur */}
              {quote?.notes && (
                <>
                  <div className="border-t border-[#F3F4F6]" />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold text-black" style={mFont}>Conditions & notes</p>
                    <p className="text-xs text-[#6B7280] whitespace-pre-wrap" style={mFont}>{quote.notes}</p>
                  </div>
                </>
              )}
            </div>

            {/* Colonne droite */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              {/* Bloc paiement / facture Stripe */}
              {(isOrderPayable || hasSucceededPayment || hasStripeInvoice) && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Facture & paiement
                  </p>

                  {hasSucceededPayment ? (
                    <>
                      <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: "#DCFCE7" }}>
                        <CheckCircle size={16} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-bold" style={{ color: "#16A34A", ...mFont }}>
                            Règlement effectué
                          </p>
                          <p className="text-xs text-[#6B7280]" style={mFont}>
                            Merci ! Le traiteur a été crédité.
                          </p>
                        </div>
                      </div>
                      {hostedInvoiceUrl && (
                        <a
                          href={hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                          style={mFont}
                        >
                          <ExternalLink size={12} />
                          Voir la facture
                        </a>
                      )}
                    </>
                  ) : isOrderPayable ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-[#6B7280]" style={mFont}>
                        Votre facture est disponible. Réglez-la directement en ligne — par carte
                        (paiement immédiat) ou par virement bancaire (coordonnées ci-dessous).
                      </p>
                      {hostedInvoiceUrl ? (
                        order.bank_transfer_declared_at ? (
                          // Virement déclaré → on désactive le paiement par
                          // carte pour éviter un double-paiement (l'un par
                          // CB immédiat, l'autre par virement en transit).
                          // Si le client change d'avis, il peut annuler sa
                          // déclaration depuis la carte virement ci-dessous.
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled
                              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold text-white cursor-not-allowed opacity-50"
                              style={{ ...mFont, backgroundColor: "#1A3A52" }}
                            >
                              <CreditCard size={13} />
                              Payer par carte - {grandTotalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </button>
                            <p className="text-[11px] text-[#9CA3AF] leading-snug px-1" style={mFont}>
                              Paiement par carte désactivé : vous avez
                              déclaré avoir émis un virement. Annulez votre
                              déclaration plus bas pour débloquer cette
                              option.
                            </p>
                          </div>
                        ) : (
                          <a
                            href={hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                            style={{ ...mFont, backgroundColor: "#1A3A52" }}
                          >
                            <CreditCard size={13} />
                            Payer par carte - {grandTotalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </a>
                        )
                      ) : (
                        <p className="text-xs text-[#9CA3AF] italic" style={mFont}>
                          Lien de paiement en cours de génération — rafraîchissez la page dans quelques secondes.
                        </p>
                      )}

                      {/* Bouton "Télécharger la facture" */}
                      {hasStripeInvoice && (
                        <DownloadInvoiceButton orderId={order.id} />
                      )}

                      {/* Coordonnées virement bancaire — récupérées côté
                          server via Stripe funding instructions. IBAN
                          virtuel unique par customer, matching automatique
                          sur l'invoice en attente (pas de référence à
                          fournir par le client). */}
                      {bankInstructions?.ok && (
                        <BankTransferCard
                          orderId={order.id}
                          accountHolderName={bankInstructions.instructions.accountHolderName}
                          bankName={bankInstructions.instructions.bankName}
                          iban={bankInstructions.instructions.iban}
                          bic={bankInstructions.instructions.bic}
                          amountTtc={grandTotalTtc}
                          declaredAt={order.bank_transfer_declared_at ?? null}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#9CA3AF] italic" style={mFont}>
                      La facture sera émise automatiquement dès que le traiteur aura marqué la prestation comme livrée.
                    </p>
                  )}
                </div>
              )}

              {/* Événement + lien vers la demande initiale */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Événement
                </p>
                <div className="flex flex-col gap-3">
                  <IconRow icon={Calendar} label="Date" value={eventDate} />
                  {(qr?.event_start_time || qr?.event_end_time) && (
                    <IconRow
                      icon={Clock}
                      label="Horaires"
                      value={[qr.event_start_time, qr.event_end_time].filter(Boolean).join(" – ")}
                    />
                  )}
                  <IconRow icon={Users} label="Convives" value={`${qr?.guest_count ?? "—"} personnes`} />
                  <IconRow icon={MapPin} label="Lieu de livraison" value={order.delivery_address} />
                  {deliveryDate && <IconRow icon={Truck} label="Date de livraison" value={deliveryDate} />}
                </div>
                {qr?.id && (
                  <Link
                    href={`/client/requests/${qr.id}`}
                    className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors w-full"
                    style={mFont}
                  >
                    <FileText size={13} />
                    Voir la demande initiale
                  </Link>
                )}
              </div>

              {/* Carte traiteur */}
              {caterer && (
                <ContactCard
                  entityType="caterer"
                  entityName={caterer.name}
                  entityLogoUrl={caterer.logo_url ?? null}
                  contactUserId={catererUserId}
                  contactFirstName={catererUser?.first_name ?? null}
                  contactLastName={catererUser?.last_name ?? null}
                  contactEmail={catererUser?.email ?? null}
                  publicProfileHref={`/client/caterers/${caterer.id}`}
                  myUserId={user!.id}
                  quoteRequestId={qr?.id}
                  orderId={order.id}
                  messagesHref={threadId ? `/client/messages?thread=${threadId}` : "/client/messages"}
                />
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Ligne "icône + valeur" — le label sémantique est préservé pour
 * l'accessibilité (aria-label) mais pas rendu visuellement : l'icône
 * contextuelle suffit pour identifier la donnée.
 */
function IconRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };
  return (
    <div className="flex items-center gap-2 min-w-0" aria-label={label}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
        aria-hidden="true"
      >
        <Icon size={15} style={{ color: "#1A3A52" }} />
      </div>
      <span className="text-sm font-bold text-black truncate min-w-0" style={mFont}>{value}</span>
    </div>
  );
}
