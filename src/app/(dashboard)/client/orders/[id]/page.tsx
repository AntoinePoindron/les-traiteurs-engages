import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrendingUp, FileText, CreditCard, Download, CheckCircle, Clock, Info } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import PayOrderButton from "./pay/PayOrderButton";
import RefreshPaymentButton from "./pay/RefreshPaymentButton";
import { formatDateTime } from "@/lib/format";
import type { OrderStatus } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const ORDER_STATUS_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "confirmed", label: "À venir" },
  { status: "delivered", label: "Livrée" },
  { status: "invoiced",  label: "Facturée" },
  { status: "paid",      label: "Payée" },
];

const ORDER_STATUS_VARIANT: Record<OrderStatus, "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"> = {
  confirmed:  "confirmed",
  delivered:  "delivered",
  invoiced:   "invoiced",
  paid:       "paid",
  disputed:   "disputed",
};

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address, notes, created_at,
      quotes!inner (
        id, reference, total_amount_ht, amount_per_person, valorisable_agefiph,
        valid_until, notes, details,
        caterers ( id, name, city, address, zip_code, logo_url, siret ),
        quote_requests (
          id, title, event_date, event_start_time, event_end_time,
          event_address, guest_count, service_type, meal_type,
          company_service_id,
          company_services ( name )
        )
      )
    `)
    .eq("id", id)
    // L'accès est géré par la RLS (créateur de la commande OU admin de la company)
    .single();

  if (!orderRaw) notFound();

  // Facture (si la commande est facturée)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoiceRaw } = await (supabase as any)
    .from("invoices")
    .select("id, esat_invoice_ref, amount_ht, amount_ttc, issued_at, due_at, status")
    .eq("order_id", id)
    .maybeSingle();

  type InvoiceRow = {
    id: string;
    esat_invoice_ref: string | null;
    amount_ht: number;
    amount_ttc: number;
    issued_at: string | null;
    due_at: string | null;
    status: string;
  };
  const invoice = invoiceRaw as InvoiceRow | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderRaw as any;
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

  const eventDate = qr?.event_date
    ? new Date(qr.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const deliveryDate = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const currentStepIdx = ORDER_STATUS_STEPS.findIndex((s) => s.status === order.status);

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
  const hasSucceededPayment = paymentsList.some((p) => p.status === "succeeded");
  const hasPendingPayment = paymentsList.some((p) => p.status === "pending" || p.status === "processing");
  const isOrderPayable =
    !hasSucceededPayment &&
    (order.status === "delivered" || order.status === "invoiced");

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
              </p>
              {qr?.company_services?.name && (
                <p className="text-sm text-[#6B7280] mt-1" style={mFont}>
                  Service : {qr.company_services.name}
                </p>
              )}
            </div>
            <StatusBadge variant={ORDER_STATUS_VARIANT[order.status as OrderStatus]} />
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

          {/* Bloc paiement */}
          {(isOrderPayable || hasSucceededPayment || hasPendingPayment) && (
            <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} style={{ color: "#1A3A52" }} />
                <p className="text-sm font-bold text-black" style={mFont}>Paiement</p>
              </div>
              {hasSucceededPayment ? (
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
              ) : hasPendingPayment ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: "#FFF3CD" }}>
                    <Clock size={16} style={{ color: "#B45309" }} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-bold" style={{ color: "#B45309", ...mFont }}>
                        Paiement en cours de traitement
                      </p>
                      <p className="text-xs text-[#6B7280]" style={mFont}>
                        Stripe finalise votre règlement. Si le statut ne se met pas à jour après
                        quelques secondes, cliquez sur &quot;Vérifier le statut&quot;.
                      </p>
                    </div>
                  </div>
                  <RefreshPaymentButton orderId={order.id} />
                </div>
              ) : isOrderPayable ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[#6B7280]" style={mFont}>
                    Prestation livrée — il ne reste plus qu&apos;à régler. Paiement sécurisé par Stripe.
                  </p>
                  <PayOrderButton
                    orderId={order.id}
                    amountLabel={`${totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                  />
                </div>
              ) : null}
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
                    <div key={step.status} className="flex items-center flex-1 last:flex-none">
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

              {/* Totaux */}
              {items.length > 0 && (
                <>
                  <div className="border-t border-[#F3F4F6]" />
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[#6B7280]" style={mFont}>Total HT</span>
                      <span className="text-sm font-bold text-black" style={mFont}>
                        {totalHT.toLocaleString("fr-FR")} €
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
                    <div className="flex justify-between pt-2 border-t border-[#F3F4F6]">
                      <span className="text-sm font-bold text-black" style={mFont}>Total TTC</span>
                      <span className="text-sm font-bold text-black" style={mFont}>
                        {totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                    {quote?.amount_per_person != null && (
                      <div className="flex justify-between">
                        <span className="text-xs text-[#9CA3AF]" style={mFont}>Soit par personne</span>
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

              <div className="bg-white rounded-lg p-6 flex flex-col gap-6">


              {/* Lien demande initiale */}
              {qr?.id && (
                <Link
                  href={`/client/requests/${qr.id}`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors w-full"
                  style={mFont}
                >
                  <FileText size={13} />
                  Voir la demande initiale
                </Link>
              )}

              {/* Facture */}
              {invoice && (
                <>
                  <div className="border-t border-[#f2f2f2]" />
                  <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F5F1E8" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={13} style={{ color: "#1A3A52" }} />
                        <p className="text-xs font-bold text-black" style={mFont}>Facture</p>
                      </div>
                      <StatusBadge
                        variant={invoice.status === "paid" ? "paid" : invoice.status === "overdue" ? "disputed" : "invoiced"}
                        customLabel={invoice.status === "paid" ? "Payée" : invoice.status === "overdue" ? "En retard" : "En attente"}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      {invoice.esat_invoice_ref && (
                        <RightRow label="Référence" value={invoice.esat_invoice_ref} />
                      )}
                      <RightRow
                        label="Montant HT"
                        value={`${Number(invoice.amount_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
                      />
                      <RightRow
                        label="Montant TTC"
                        value={`${Number(invoice.amount_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
                      />
                      {invoice.issued_at && (
                        <RightRow label="Émise le" value={new Date(invoice.issued_at).toLocaleDateString("fr-FR")} />
                      )}
                      {invoice.due_at && (
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs text-[#6B7280]" style={mFont}>Échéance</span>
                          <span
                            className="text-xs font-bold text-right"
                            style={{
                              color: new Date(invoice.due_at) < new Date() && invoice.status !== "paid" ? "#DC2626" : "#000",
                              ...mFont,
                            }}
                          >
                            {new Date(invoice.due_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <Link
                        href={`/client/orders/${id}/invoice`}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                        style={mFont}
                      >
                        <Download size={12} />
                        Voir &amp; télécharger
                      </Link>
                      {invoice.status !== "paid" && (
                        <button
                          type="button"
                          disabled
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white opacity-40"
                          style={{ backgroundColor: "#1A3A52", ...mFont }}
                          title="Module de paiement à venir"
                        >
                          <CreditCard size={12} />
                          Payer la facture
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-[#f2f2f2]" />

              {/* Événement */}
              <div className="flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Événement
                </p>
                <div className="flex flex-col gap-3">
                  <RightRow label="Date" value={eventDate} />
                  {(qr?.event_start_time || qr?.event_end_time) && (
                    <RightRow
                      label="Horaires"
                      value={[qr.event_start_time, qr.event_end_time].filter(Boolean).join(" – ")}
                    />
                  )}
                  <RightRow label="Convives" value={`${qr?.guest_count ?? "—"} personnes`} />
                  <RightRow label="Lieu de livraison" value={order.delivery_address} />
                  {deliveryDate && <RightRow label="Date de livraison" value={deliveryDate} />}
                </div>
              </div>

              <div className="border-t border-[#f2f2f2]" />

              {/* Montant */}
              <div className="flex flex-col gap-3">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Montant
                </p>
                <RightRow label="Total HT" value={`${totalHT.toLocaleString("fr-FR")} €`} />
                <RightRow
                  label="Total TTC"
                  value={`${totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                />
                {quote?.amount_per_person != null && (
                  <RightRow
                    label="Par personne"
                    value={`${Number(quote.amount_per_person).toLocaleString("fr-FR")} € HT`}
                  />
                )}
                {quote?.valorisable_agefiph != null && (
                  <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "#F0F4F7" }}>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#1A3A52]" style={mFont}>
                      <TrendingUp size={11} />
                      Val. AGEFIPH
                    </span>
                    <span className="text-xs font-bold text-[#1A3A52]" style={mFont}>
                      {Number(quote.valorisable_agefiph).toLocaleString("fr-FR")} €
                    </span>
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

function RightRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-[#6B7280]" style={mFont}>{label}</span>
      <span className="text-xs font-bold text-black text-right" style={mFont}>{value}</span>
    </div>
  );
}
