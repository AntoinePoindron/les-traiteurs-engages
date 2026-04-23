import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Calendar, MapPin, Users, Clock, Truck, FileText,
  CheckCircle, AlertTriangle, CreditCard, ExternalLink, Utensils,
} from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import DownloadInvoiceButton from "@/components/client/DownloadInvoiceButton";
import { formatDateTime } from "@/lib/format";
import { dismissNotifications } from "@/lib/notifications";
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

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// ── Stepper 5 étapes (miroir traiteur) ──
// On garde les 5 étapes distinctes côté admin pour voir exactement où
// en est le parcours, y compris "Livrée" et "Virement en cours".
type StepKey = OrderStatus | "bank_transfer_pending";

const ORDER_STATUS_STEPS: { key: StepKey; label: string }[] = [
  { key: "confirmed",              label: "À venir" },
  { key: "delivered",              label: "Livrée" },
  { key: "invoiced",               label: "Facturée" },
  { key: "bank_transfer_pending",  label: "Virement en cours" },
  { key: "paid",                   label: "Payée" },
];

function adminStatusVariant(
  status: OrderStatus,
  bankTransferDeclaredAt: string | null = null,
): "confirmed" | "delivered" | "invoiced" | "paid" | "disputed" | "pending" {
  if (
    bankTransferDeclaredAt &&
    (status === "delivered" || status === "invoiced")
  ) {
    return "pending";
  }
  return status as "confirmed" | "delivered" | "invoiced" | "paid" | "disputed";
}

function adminStatusLabel(
  status: OrderStatus,
  bankTransferDeclaredAt: string | null = null,
): string | undefined {
  if (
    bankTransferDeclaredAt &&
    (status === "delivered" || status === "invoiced")
  ) {
    return "Virement en cours";
  }
  return undefined;
}

// Mêmes libellés que côté traiteur pour cohérence visuelle
const SECTION_LABELS: Record<string, string> = {
  main:   "Prestations principales",
  drinks: "Boissons",
  extra:  "Prestations complémentaires",
};

// Labels meal_type (identiques à caterer/orders/[id])
const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail",
  petit_dejeuner: "Petit-déjeuner", autre: "Apéritif",
};

function fmt(n: number) {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(s).toLocaleDateString("fr-FR", opts ?? {
    day: "numeric", month: "long", year: "numeric",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Page ───────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Dismiss la notif dispute_opened_admin pour cette entité quand l'admin
  // arrive sur la page (cohérent avec les autres pages).
  if (user) {
    await dismissNotifications({
      userId: user.id,
      types: ["dispute_opened_admin"],
      entityId: id,
    });
  }

  // La RLS `orders_select` laisse passer tous les orders pour un super_admin.
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
          client_user_id,
          users ( id, first_name, last_name, email ),
          companies ( id, name, siret, city, address, zip_code, logo_url )
        )
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!orderRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderRaw as any;
  const hasStripeInvoice = !!order.stripe_invoice_id;
  const hostedInvoiceUrl: string | null = order.stripe_hosted_invoice_url ?? null;
  const quote = order.quotes;
  const caterer = quote?.caterers;
  const qr = quote?.quote_requests;
  const company = qr?.companies;
  const clientUser = qr?.users;

  // Items groupés par section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(quote?.details) ? quote.details : [];
  const sections = ["main", "drinks", "extra"] as const;
  const grouped = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sections.map((s) => [s, items.filter((i: any) => (i.section ?? "main") === s)]),
  );

  // Calculs
  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const tva = item.tva_rate ?? 0;
    const lineHT = (item.quantity ?? 0) * (item.unit_price_ht ?? 0);
    tvaMap[tva] = (tvaMap[tva] ?? 0) + lineHT * (tva / 100);
  }
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
  const totalHT = Number(quote?.total_amount_ht ?? 0);
  const totalTTC = totalHT + totalTVA;
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

  // Étape active du stepper
  const currentStepKey: StepKey = (() => {
    if (order.status === "paid") return "paid";
    if (
      (order.status === "invoiced" || order.status === "delivered") &&
      order.bank_transfer_declared_at
    ) {
      return "bank_transfer_pending";
    }
    return order.status;
  })();
  const currentStepIdx = ORDER_STATUS_STEPS.findIndex((s) => s.key === currentStepKey);

  // ── User traiteur (pour le bouton "Envoyer un message") ──
  // La table `users` a un `caterer_id` FK → on récupère le user dont le
  // rôle est `caterer` pour cette structure (un par traiteur au MVP).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererUserRow } = await (supabase as any)
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("caterer_id", caterer?.id ?? "")
    .eq("role", "caterer")
    .limit(1)
    .maybeSingle();
  const catererUser = catererUserRow as
    | { id: string; first_name: string | null; last_name: string | null; email: string }
    | null;

  // ── Thread existant pour préselectionner la conversation ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: threadRow } = await (supabase as any)
    .from("messages")
    .select("thread_id")
    .eq("quote_request_id", qr?.id ?? "")
    .limit(1)
    .maybeSingle();
  const threadId = (threadRow as { thread_id: string } | null)?.thread_id ?? null;

  // Paiements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentsRaw } = await (supabase as any)
    .from("payments")
    .select("id, status, amount_total_cents, application_fee_cents, amount_to_caterer_cents, succeeded_at, failure_reason, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const paymentsList = (paymentsRaw ?? []) as Array<{
    id: string;
    status: string;
    amount_total_cents: number;
    application_fee_cents: number | null;
    amount_to_caterer_cents: number | null;
    succeeded_at: string | null;
    failure_reason: string | null;
    created_at: string;
  }>;

  const isBankTransferPending =
    !!order.bank_transfer_declared_at && order.status !== "paid";

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: 1020 }}>

          <BackButton label="Retour" />

          {/* Title */}
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
            </div>
            <StatusBadge
              variant={adminStatusVariant(order.status, order.bank_transfer_declared_at)}
              customLabel={adminStatusLabel(order.status, order.bank_transfer_declared_at)}
            />
          </div>

          {/* Stepper (masqué en litige) */}
          {order.status !== "disputed" && currentStepIdx >= 0 && (
            <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
              <p
                className="font-display font-bold text-xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Suivi de la commande
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

          {/* Bandeau litige si applicable */}
          {order.status === "disputed" && (
            <div
              className="rounded-lg p-4 flex items-start gap-3"
              style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}
            >
              <AlertTriangle size={18} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold" style={{ color: "#991B1B", ...mFont }}>
                  Commande en litige
                </p>
                {order.notes && (
                  <p className="text-xs whitespace-pre-wrap" style={{ color: "#7F1D1D", ...mFont }}>
                    {order.notes.replace(/^\s*LITIGE\s*:\s*/i, "")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Colonne gauche : détails commande + items ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

              {/* L'événement (même layout que côté traiteur) */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  L&apos;événement
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <IconRow
                    icon={Utensils}
                    label="Type"
                    value={MEAL_TYPE_LABELS[qr?.meal_type ?? ""] ?? qr?.meal_type}
                  />
                  <IconRow icon={Calendar} label="Date" value={fmtDate(qr?.event_date)} />
                  {(qr?.event_start_time || qr?.event_end_time) && (
                    <IconRow
                      icon={Clock}
                      label="Horaires"
                      value={[qr.event_start_time, qr.event_end_time].filter(Boolean).join(" – ")}
                    />
                  )}
                  <IconRow
                    icon={MapPin}
                    label="Lieu"
                    value={qr?.event_address ?? order.delivery_address}
                  />
                  <IconRow icon={Users} label="Convives" value={`${qr?.guest_count ?? "—"} personnes`} />
                  {deliveryDate && <IconRow icon={Truck} label="Livraison" value={deliveryDate} />}
                </div>
              </div>

              {/* Items */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Détail des prestations
                </p>
                {sections.map((key) => {
                  const list = grouped[key] ?? [];
                  if (list.length === 0) return null;
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                        {SECTION_LABELS[key]}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {list.map((item: any, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 py-1.5"
                            style={{ borderBottom: "1px solid #F9FAFB" }}
                          >
                            {/* Chip quantité (largeur fixe 52px pour
                                aligner les libellés à la même colonne) */}
                            <div className="shrink-0 flex justify-end pt-0.5" style={{ width: 52 }}>
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap"
                                style={{ backgroundColor: "#F5F1E8", color: "#1A3A52", ...mFont }}
                              >
                                ×{item.quantity ?? 1}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <p className="text-sm font-bold text-black" style={mFont}>
                                {item.label}
                              </p>
                              {item.description && (
                                <p className="text-xs text-[#6B7280]" style={mFont}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <p className="text-xs font-bold text-black shrink-0" style={mFont}>
                              {fmt((item.quantity ?? 1) * (item.unit_price_ht ?? 0))}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Paiements */}
              {paymentsList.length > 0 && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Historique des paiements
                  </p>
                  <div className="flex flex-col gap-3">
                    {paymentsList.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg p-3 flex items-start gap-3"
                        style={{ backgroundColor: p.status === "succeeded" ? "#DCFCE7" : p.status === "failed" ? "#FEE2E2" : "#F8F9FA" }}
                      >
                        {p.status === "succeeded" ? (
                          <CheckCircle size={16} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
                        ) : p.status === "failed" ? (
                          <AlertTriangle size={16} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
                        ) : (
                          <CreditCard size={16} style={{ color: "#6B7280" }} className="shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-black" style={mFont}>
                            {fmt(p.amount_total_cents / 100)} — {p.status === "succeeded" ? "Réglé" : p.status === "failed" ? "Échec" : p.status}
                          </p>
                          {p.amount_to_caterer_cents != null && (
                            <p className="text-xs text-[#6B7280]" style={mFont}>
                              {fmt(p.amount_to_caterer_cents / 100)} au traiteur ·{" "}
                              {p.application_fee_cents != null
                                ? fmt(p.application_fee_cents / 100) + " commission"
                                : null}
                            </p>
                          )}
                          {p.failure_reason && (
                            <p className="text-xs text-[#7F1D1D] mt-0.5" style={mFont}>
                              {p.failure_reason}
                            </p>
                          )}
                          <p className="text-[10px] text-[#9CA3AF] mt-1" style={mFont}>
                            {formatDateTime(p.succeeded_at ?? p.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite : récap + parties + facture ── */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              {/* Récapitulatif */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Récapitulatif
                </p>

                {/* Bloc "Virement émis par le client" intégré au récap
                    (plus d'encart stand-alone en dessous). L'info prime
                    sur les chiffres : c'est le contexte qui explique
                    pourquoi le paiement est en attente. */}
                {hasStripeInvoice && isBankTransferPending && (
                  <div
                    className="rounded-lg p-3 flex flex-col gap-2"
                    style={{ backgroundColor: "#FEF3C7" }}
                  >
                    <p className="text-xs font-bold" style={{ color: "#B45309", ...mFont }}>
                      Virement émis par le client
                    </p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#78350F", ...mFont }}>
                      Le client a déclaré avoir émis le virement le{" "}
                      {new Date(order.bank_transfer_declared_at!).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      . Délai SEPA 1-3 jours ouvrés.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6B7280]" style={mFont}>Total HT</p>
                    <p className="text-xs text-black" style={mFont}>{fmt(totalHT)}</p>
                  </div>
                  {Object.entries(tvaMap).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
                    <div key={rate} className="flex items-center justify-between">
                      <p className="text-xs text-[#6B7280]" style={mFont}>TVA {rate} %</p>
                      <p className="text-xs text-[#6B7280]" style={mFont}>{fmt(amount)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</p>
                    <p className="text-xs font-bold text-black" style={mFont}>{fmt(totalTTC)}</p>
                  </div>
                </div>

                {/* Frais de mise en relation */}
                <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                    {PLATFORM_FEE_LABEL} ({Math.round(PLATFORM_FEE_RATE_DISPLAY * 100)}%)
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6B7280]" style={mFont}>HT</p>
                    <p className="text-xs text-black" style={mFont}>{fmt(feeHt)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6B7280]" style={mFont}>TVA {PLATFORM_FEE_TVA_RATE} %</p>
                    <p className="text-xs text-[#6B7280]" style={mFont}>{fmt(feeTva)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</p>
                    <p className="text-xs font-bold text-black" style={mFont}>{fmt(feeTtc)}</p>
                  </div>
                </div>

                {/* Total à payer par le client */}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <p className="text-sm font-bold text-black" style={mFont}>Total client</p>
                  <p className="text-xl font-bold" style={{ color: "#1A3A52", ...mFont }}>
                    {fmt(grandTotalTtc)}
                  </p>
                </div>

                {/* Bouton Télécharger la facture — en virement en cours le
                    bloc Facture Stripe est masqué, donc on ajoute le
                    bouton ici pour que l'admin puisse quand même
                    accéder au PDF. */}
                {hasStripeInvoice && isBankTransferPending && (
                  <DownloadInvoiceButton orderId={order.id} />
                )}

                {/* Lien vers la demande initiale */}
                {qr?.id && (
                  <Link
                    href={`/admin/qualification/${qr.id}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                    style={mFont}
                  >
                    <FileText size={13} />
                    Voir la demande initiale
                  </Link>
                )}
              </div>

              {/* Bloc Facture Stripe (masqué en virement en cours, remplacé par le bloc dédié) */}
              {hasStripeInvoice && !isBankTransferPending && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
                  <p className="font-display font-bold text-base text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Facture Stripe
                  </p>
                  <DownloadInvoiceButton orderId={order.id} />
                  {hostedInvoiceUrl && (
                    <a
                      href={hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                      style={mFont}
                    >
                      <ExternalLink size={12} />
                      Page Stripe (hosted)
                    </a>
                  )}
                </div>
              )}

              {/* Bloc Collaborateurs (Client + Traiteur) — fond blanc
                  unique + titre de section. Les 2 ContactCard sont en
                  mode `nested` (pas de fond propre) pour éviter le
                  double fond blanc imbriqué. Un séparateur discret
                  visuelle les sépare. */}
              {(company || caterer) && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p
                    className="font-display font-bold text-xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Collaborateurs
                  </p>

                  <div className="flex flex-col gap-5 divide-y divide-[#F3F4F6]">
                    {company && (
                      <div className="first:pt-0 pt-5">
                        <ContactCard
                          nested
                          entityType="client"
                          entityName={company.name ?? null}
                          entityLogoUrl={company.logo_url ?? null}
                          contactUserId={clientUser?.id ?? null}
                          contactFirstName={clientUser?.first_name ?? null}
                          contactLastName={clientUser?.last_name ?? null}
                          contactEmail={clientUser?.email ?? null}
                          publicProfileHref={`/admin/companies/${company.id}`}
                          myUserId={user!.id}
                          quoteRequestId={qr?.id}
                          orderId={order.id}
                          messagesHref={threadId ? `/admin/messages?thread=${threadId}` : "/admin/messages"}
                        />
                      </div>
                    )}

                    {caterer && (
                      <div className="first:pt-0 pt-5">
                        <ContactCard
                          nested
                          entityType="caterer"
                          entityName={caterer.name ?? null}
                          entityLogoUrl={caterer.logo_url ?? null}
                          contactUserId={catererUser?.id ?? null}
                          contactFirstName={catererUser?.first_name ?? null}
                          contactLastName={catererUser?.last_name ?? null}
                          contactEmail={catererUser?.email ?? null}
                          publicProfileHref={`/admin/caterers/${caterer.id}`}
                          myUserId={user!.id}
                          quoteRequestId={qr?.id}
                          orderId={order.id}
                          messagesHref={threadId ? `/admin/messages?thread=${threadId}` : "/admin/messages"}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────

// IconRow aligné sur le pattern caterer/client (Option B) :
// carré bleu transparent (rgba 26,58,82 / 0.08), icône bleue, texte
// gras tronqué. Le label n'apparaît que dans l'aria-label (pas
// visuellement) — c'est l'icône + la valeur qui suffisent.
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
  return (
    <div className="flex items-center gap-2 min-w-0" aria-label={label}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(26,58,82,0.08)" }}
        aria-hidden="true"
      >
        <Icon size={15} style={{ color: "#1A3A52" }} />
      </div>
      <span
        className="text-sm font-bold text-black truncate min-w-0"
        style={mFont}
      >
        {value}
      </span>
    </div>
  );
}
