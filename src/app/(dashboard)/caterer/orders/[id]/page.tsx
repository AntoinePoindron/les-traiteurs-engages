import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, FileText } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import { formatDateTime } from "@/lib/format";
import type { OrderStatus } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Status progression ──────────────────────────────────────

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  confirmed: { next: "delivered", label: "Marquer comme livrée" },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed:  "À venir",
  delivered:  "Livrée",
  invoiced:    "Facturée",
  paid:        "Payée",
  disputed:    "En litige",
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail",
  petit_dejeuner: "Petit-déjeuner", autre: "Apéritif",
};

const SECTION_TITLES: Record<string, string> = {
  main: "Prestations principales",
  drinks: "Boissons",
  extra: "Prestations complémentaires",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(s: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(s).toLocaleDateString("fr-FR", opts ?? {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Server action : avancer le statut ──────────────────────

async function advanceStatus(formData: FormData) {
  "use server";
  const orderId  = formData.get("orderId") as string;
  const nextStatus = formData.get("nextStatus") as string;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId);

  redirect(`/caterer/orders/${orderId}`);
}

// ── Page ────────────────────────────────────────────────────

export default async function CatererOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("users").select("caterer_id").eq("id", user!.id).single();
  const catererId = (profileData as { caterer_id: string | null } | null)?.caterer_id ?? "";

  const { data: orderData } = await supabase
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address, notes, created_at,
      quotes!inner (
        id, reference, total_amount_ht, notes, details, caterer_id,
        quote_requests!inner (
          id, title, event_date, event_start_time, event_end_time,
          event_address, guest_count, meal_type, description,
          companies ( name, logo_url ),
          users ( id, first_name, last_name, email )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!orderData) notFound();

  type FullOrder = {
    id: string;
    status: OrderStatus;
    delivery_date: string;
    delivery_address: string;
    notes: string | null;
    created_at: string;
    quotes: {
      id: string;
      reference: string | null;
      total_amount_ht: number;
      notes: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: any[];
      caterer_id: string;
      quote_requests: {
        id: string;
        title: string;
        event_date: string;
        event_start_time: string | null;
        event_end_time: string | null;
        event_address: string;
        guest_count: number;
        meal_type: string;
        description: string | null;
        companies: { name: string; logo_url: string | null } | null;
        users: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
      } | null;
    } | null;
  };

  const order = orderData as FullOrder;

  // Vérification accès caterer
  if (order.quotes?.caterer_id !== catererId) notFound();

  const q = order.quotes!;
  const qr = q.quote_requests!;
  const transition = STATUS_TRANSITIONS[order.status];

  // Fetch thread_id for this order's quote request
  const { data: threadMsg } = await supabase
    .from("messages")
    .select("thread_id")
    .eq("quote_request_id", q.quote_requests?.id ?? "")
    .limit(1)
    .maybeSingle() as unknown as { data: { thread_id: string } | null };
  const threadId = threadMsg?.thread_id ?? null;

  // Fetch invoice if exists
  const { data: invoiceData } = await supabase
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
  const invoice = invoiceData as InvoiceRow | null;

  // Calcul totaux depuis details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = q.details ?? [];
  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const ht = (item.quantity ?? 1) * (item.unit_price_ht ?? 0);
    tvaMap[item.tva_rate] = (tvaMap[item.tva_rate] ?? 0) + (ht * item.tva_rate) / 100;
  }
  const totalHT  = q.total_amount_ht;
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
  const totalTTC = totalHT + totalTVA;

  // Sections
  const sections: Record<string, typeof items> = { main: [], drinks: [], extra: [] };
  for (const item of items) {
    (sections[item.section ?? "main"] ??= []).push(item);
  }

  const clientUser = qr.users;
  const clientName = clientUser
    ? `${clientUser.first_name ?? ""} ${clientUser.last_name ?? ""}`.trim() || clientUser.email
    : null;

  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  return (
    <main className="flex-1" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: 1020 }}>

          {/* Back */}
          <BackButton label="Retour" />

          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {qr.title}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={mFont}>
                Créée le {formatDateTime(order.created_at)}
              </p>
              {q.reference && (
                <p className="text-sm text-[#9CA3AF]" style={mFont}>{q.reference}</p>
              )}
            </div>
            <StatusBadge variant={order.status as "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"} />
          </div>

          {/* Main layout */}
          <div className="flex gap-6 items-start">

            {/* ── Colonne gauche : détails du devis ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

              {/* Prestations */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-6">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Détail des prestations
                </p>

                {(["main", "drinks", "extra"] as const).map((key) => {
                  if (!sections[key]?.length) return null;
                  return (
                    <div key={key} className="flex flex-col gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                        {SECTION_TITLES[key]}
                      </p>
                      <table className="w-full" style={{ borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                            {["Désignation", "Qté", "PU HT", "TVA", "Total HT"].map((h, i) => (
                              <th key={h} className="pb-2 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide" style={{ ...mFont, textAlign: i === 0 ? "left" : "right" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sections[key].map((item: { id?: string; label?: string; description?: string; quantity?: number; unit_price_ht?: number; tva_rate?: number }, i: number) => (
                            <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}>
                              <td className="py-3 align-top">
                                <p className="text-sm font-bold text-black" style={mFont}>{item.label}</p>
                                {item.description && (
                                  <p className="text-xs text-[#9CA3AF]" style={mFont}>{item.description}</p>
                                )}
                              </td>
                              <td className="py-3 text-xs text-right text-[#444]" style={mFont}>{item.quantity}</td>
                              <td className="py-3 text-xs text-right text-[#444]" style={mFont}>{fmt(item.unit_price_ht ?? 0)}</td>
                              <td className="py-3 text-xs text-right text-[#444]" style={mFont}>{item.tva_rate} %</td>
                              <td className="py-3 text-xs text-right font-bold text-black" style={mFont}>
                                {fmt((item.quantity ?? 1) * (item.unit_price_ht ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Totaux */}
                <div className="flex flex-col gap-2 items-end pt-2" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <div className="flex justify-between w-64">
                    <p className="text-sm text-[#6B7280]" style={mFont}>Total HT</p>
                    <p className="text-sm font-bold text-black" style={mFont}>{fmt(totalHT)}</p>
                  </div>
                  {Object.entries(tvaMap).sort(([a],[b]) => Number(a)-Number(b)).map(([rate, amount]) => (
                    <div key={rate} className="flex justify-between w-64">
                      <p className="text-xs text-[#9CA3AF]" style={mFont}>TVA {rate} %</p>
                      <p className="text-xs text-[#9CA3AF]" style={mFont}>{fmt(amount)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between w-64 pt-2" style={{ borderTop: "1px solid #E5E7EB" }}>
                    <p className="text-base font-bold text-black" style={mFont}>Total TTC</p>
                    <p className="font-display font-bold text-2xl text-[#1A3A52]" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                      {fmt(totalTTC)}
                    </p>
                  </div>
                  {qr.guest_count > 0 && (
                    <p className="text-xs text-[#9CA3AF]" style={mFont}>
                      soit {fmt(totalTTC / qr.guest_count)} / personne
                    </p>
                  )}
                </div>
              </div>

              {/* Notes du devis */}
              {q.notes && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
                  <h2 className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Notes et conditions
                  </h2>
                  <p className="text-sm text-[#444] leading-relaxed whitespace-pre-wrap" style={mFont}>{q.notes}</p>
                </div>
              )}

            </div>

            {/* ── Colonne droite : carte client + panel action ── */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              <ContactCard
                entityType="client"
                entityName={qr.companies?.name ?? null}
                entityLogoUrl={qr.companies?.logo_url ?? null}
                contactUserId={clientUser?.id ?? null}
                contactFirstName={clientUser?.first_name ?? null}
                contactLastName={clientUser?.last_name ?? null}
                contactEmail={clientUser?.email ?? null}
                myUserId={user!.id}
                quoteRequestId={qr.id}
                orderId={order.id}
                messagesHref={threadId ? `/caterer/messages?thread=${threadId}` : "/caterer/messages"}
              />

              <div className="bg-white rounded-lg p-6 flex flex-col gap-6">

              {/* Facture (si créée) — fond beige, juste sous le client */}
              {invoice && (
                <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F5F1E8" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-black" style={mFont}>Facture</p>
                    <StatusBadge
                      variant={invoice.status === "paid" ? "paid" : invoice.status === "overdue" ? "disputed" : "invoiced"}
                      customLabel={invoice.status === "paid" ? "Payée" : invoice.status === "overdue" ? "En retard" : "En attente"}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {invoice.esat_invoice_ref && (
                      <Row label="Référence" value={invoice.esat_invoice_ref} />
                    )}
                    <Row label="Montant HT"  value={fmt(invoice.amount_ht)} />
                    <Row label="Montant TTC" value={fmt(invoice.amount_ttc)} />
                    {invoice.issued_at && (
                      <Row label="Émise le"  value={fmtDate(invoice.issued_at)} />
                    )}
                    {invoice.due_at && (
                      <Row label="Échéance"  value={fmtDate(invoice.due_at)} />
                    )}
                  </div>
                </div>
              )}

              {/* CTA avancement / création facture (style harmonisé avec le client) */}
              {transition ? (
                <form action={advanceStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextStatus" value={transition.next} />
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ ...mFont, backgroundColor: "#1A3A52" }}
                  >
                    {transition.label}
                  </button>
                </form>
              ) : order.status === "delivered" && !invoice ? (
                <Link
                  href={`/caterer/orders/${order.id}/invoice`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ ...mFont, backgroundColor: "#1A3A52" }}
                >
                  <FileText size={13} />
                  Créer la facture
                </Link>
              ) : null}

              <div className="border-t border-[#f2f2f2]" />

              {/* Événement */}
              <div className="flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Événement
                </p>
                <div className="flex flex-col gap-3">
                  <Row label="Type" value={MEAL_TYPE_LABELS[qr.meal_type] ?? qr.meal_type} />
                  <Row label="Date" value={fmtDate(qr.event_date)} />
                  {(qr.event_start_time || qr.event_end_time) && (
                    <Row label="Horaires" value={[qr.event_start_time, qr.event_end_time].filter(Boolean).join(" – ")} />
                  )}
                  <Row label="Lieu" value={qr.event_address ?? order.delivery_address} />
                  <Row label="Convives" value={`${qr.guest_count} personnes`} />
                </div>
                {qr.description && (
                  <p className="text-xs text-[#6B7280] italic leading-relaxed" style={mFont}>
                    &ldquo;{qr.description}&rdquo;
                  </p>
                )}
              </div>

              <div className="border-t border-[#f2f2f2]" />

              {/* Livraison */}
              <div className="flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Livraison
                </p>
                <div className="flex flex-col gap-3">
                  <Row label="Date" value={fmtDate(order.delivery_date)} />
                  <Row label="Adresse" value={order.delivery_address} />
                  {order.notes && <Row label="Notes" value={order.notes} />}
                </div>
              </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };
  return (
    <div className="flex gap-3 items-start justify-between">
      <p className="text-xs text-[#6B7280] shrink-0" style={mFont}>{label}</p>
      <p className="text-xs font-bold text-black text-right" style={mFont}>{value}</p>
    </div>
  );
}
