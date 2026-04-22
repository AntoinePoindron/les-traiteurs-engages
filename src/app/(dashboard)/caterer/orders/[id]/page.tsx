import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Calendar, MapPin, Users, Utensils, Clock, Truck, ExternalLink, FileText } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import ContactCard from "@/components/ui/ContactCard";
import SubmitButton from "@/components/ui/SubmitButton";
import QuoteViewerButton from "@/components/caterer/QuoteViewerButton";
import { formatDateTime } from "@/lib/format";
import { generateOrderInvoice } from "@/lib/stripe/invoices";
import { deriveInvoiceReference } from "@/lib/stripe/constants";
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

  // Passage en livré → on génère la facture Stripe automatiquement.
  // generateOrderInvoice est idempotent : si une facture existe déjà,
  // il ne la recrée pas. En cas d'échec (compte traiteur non validé,
  // etc.), on laisse la commande en "delivered" — le traiteur pourra
  // retenter via le bouton manuel.
  if (nextStatus === "delivered") {
    const res = await generateOrderInvoice(orderId);
    if (!res.ok) {
      console.error("[advanceStatus] generateOrderInvoice failed:", res.error);
    }
  }

  redirect(`/caterer/orders/${orderId}`);
}

// ── Server action : (re)générer manuellement la facture ──────
// Utilisé comme filet de sécurité si la génération automatique a
// échoué au moment du passage en "livrée".

async function triggerInvoiceGeneration(formData: FormData) {
  "use server";
  const orderId = formData.get("orderId") as string;
  const res = await generateOrderInvoice(orderId);
  if (!res.ok) {
    console.error("[triggerInvoiceGeneration] failed:", res.error);
  }
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
      stripe_invoice_id, stripe_hosted_invoice_url,
      quotes!inner (
        id, reference, valid_until, total_amount_ht, notes, details, caterer_id,
        quote_requests!inner (
          id, title, event_date, event_start_time, event_end_time,
          event_address, guest_count, meal_type, description,
          companies ( name, siret, address, city, zip_code, logo_url ),
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
    stripe_invoice_id: string | null;
    stripe_hosted_invoice_url: string | null;
    quotes: {
      id: string;
      reference: string | null;
      valid_until: string | null;
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
        companies: {
          name: string;
          siret: string | null;
          address: string | null;
          city: string | null;
          zip_code: string | null;
          logo_url: string | null;
        } | null;
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

  // La facture est désormais portée par Stripe — on ne lit plus la table
  // `invoices` locale (conservée pour l'historique ESAT si besoin). Les
  // deux champs stripe_* sur orders suffisent à l'afficher ici.
  const hasStripeInvoice = !!order.stripe_invoice_id;

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

  // Fetch caterer info pour la preview devis (header du PDF)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererData } = await (supabase as any)
    .from("caterers")
    .select("name, address, city, zip_code, siret, logo_url")
    .eq("id", catererId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cd = catererData as any;
  const catererInfo = {
    name: cd?.name ?? "",
    address: cd?.address ?? null,
    city: cd?.city ?? null,
    zip_code: cd?.zip_code ?? null,
    siret: cd?.siret ?? null,
    logo_url: cd?.logo_url ?? null,
  };

  // Preview data du devis — consommée par QuoteViewerButton pour ouvrir
  // la modale d'aperçu / PDF. On rebuild le format attendu par PreviewData.
  const previewData = {
    reference: q.reference ?? "",
    validUntil: q.valid_until ?? "",
    notes: q.notes ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (q.details ?? []).map((d: any, idx: number) => ({
      id: d.id ?? String(idx),
      label: d.label ?? "",
      description: d.description ?? "",
      quantity: d.quantity ?? 1,
      unit_price_ht: d.unit_price_ht ?? 0,
      tva_rate: d.tva_rate ?? 10,
      section: (d.section ?? "main") as "main" | "drinks" | "extra",
    })),
    totalHT,
    tvaMap,
    totalTVA,
    totalTTC,
    guestCount: qr.guest_count,
    eventDate: qr.event_date,
    eventAddress: qr.event_address,
    mealTypeLabel: MEAL_TYPE_LABELS[qr.meal_type] ?? qr.meal_type,
    client: {
      companyName: qr.companies?.name ?? null,
      contactName: clientName,
      email: clientUser?.email ?? null,
      siret: qr.companies?.siret ?? null,
      address: [qr.companies?.address, qr.companies?.zip_code, qr.companies?.city]
        .filter(Boolean)
        .join(", ") || null,
    },
  };

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
                <p className="text-sm text-[#9CA3AF]" style={mFont}>
                  Devis {q.reference}
                  {hasStripeInvoice && deriveInvoiceReference(q.reference) && (
                    <> · Facture {deriveInvoiceReference(q.reference)}</>
                  )}
                </p>
              )}
            </div>
            <StatusBadge variant={order.status as "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"} />
          </div>

          {/* Main layout */}
          <div className="flex gap-6 items-start">

            {/* ── Colonne gauche : résumé événement + détails du devis ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

              {/* Résumé événement en haut de la colonne */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  L&apos;événement
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <IconRow icon={Utensils} label="Type" value={MEAL_TYPE_LABELS[qr.meal_type] ?? qr.meal_type} />
                  <IconRow icon={Calendar} label="Date" value={fmtDate(qr.event_date)} />
                  {(qr.event_start_time || qr.event_end_time) && (
                    <IconRow
                      icon={Clock}
                      label="Horaires"
                      value={[qr.event_start_time, qr.event_end_time].filter(Boolean).join(" – ")}
                    />
                  )}
                  <IconRow icon={MapPin} label="Lieu" value={qr.event_address ?? order.delivery_address} />
                  <IconRow icon={Users} label="Convives" value={`${qr.guest_count} personnes`} />
                </div>
                {qr.description && (
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{ backgroundColor: "#F5F1E8", color: "#000", ...mFont }}
                  >
                    <span className="font-bold">Type d&apos;événement · </span>
                    {qr.description}
                  </div>
                )}
              </div>

              {/* Prestations — simple liste sans prix (les prix sont dans
                  le récapitulatif à droite et dans le PDF du devis). Le
                  traiteur voit ici le "quoi", le "combien en €" vit à
                  côté. */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Détail des prestations
                </p>

                {(["main", "drinks", "extra"] as const).map((key) => {
                  if (!sections[key]?.length) return null;
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
                        {SECTION_TITLES[key]}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {sections[key].map((item: { id?: string; label?: string; description?: string; quantity?: number }, i: number) => (
                          <li key={i} className="flex items-start gap-3 py-1.5" style={{ borderBottom: "1px solid #F9FAFB" }}>
                            {/* Chip wrapper à largeur fixe + alignement droite,
                                pour que les libellés démarrent tous à la même
                                colonne quelle que soit la taille du nombre. */}
                            <div className="shrink-0 flex justify-end pt-0.5" style={{ width: 52 }}>
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap"
                                style={{ backgroundColor: "#F5F1E8", color: "#1A3A52", ...mFont }}
                              >
                                ×{item.quantity ?? 1}
                              </span>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <p className="text-sm font-bold text-black" style={mFont}>{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-[#6B7280]" style={mFont}>{item.description}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
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

            {/* ── Colonne droite : récap (liens + totaux) + actions + client + livraison ── */}
            <div className="flex flex-col gap-4 w-full md:w-[324px] md:shrink-0">

              {/* Récapitulatif : tout-en-un.
                  - Si la commande est en litige, le motif apparaît en
                    tout premier sous le titre (info prioritaire).
                  - Si la facture Stripe a été émise, l'encart apparaît
                    ensuite.
                  - Bouton du devis + totaux au centre.
                  - Actions contextuelles (transition de statut ou
                    émission manuelle de facture) en bas.
                  - Lien vers la demande initiale toujours tout en bas. */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Récapitulatif
                </p>

                {order.status === "disputed" && (
                  <div
                    className="rounded-lg p-4 flex flex-col gap-2"
                    style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold" style={{ color: "#991B1B", ...mFont }}>
                        Commande en litige
                      </p>
                      <StatusBadge variant="disputed" />
                    </div>
                    {order.notes ? (
                      <p
                        className="text-xs leading-relaxed whitespace-pre-wrap"
                        style={{ color: "#7F1D1D", ...mFont }}
                      >
                        {order.notes.replace(/^\s*LITIGE\s*:\s*/i, "")}
                      </p>
                    ) : (
                      <p className="text-xs italic" style={{ color: "#B91C1C", ...mFont }}>
                        Aucun motif renseigné — contactez le client pour clarifier le litige.
                      </p>
                    )}
                  </div>
                )}

                {hasStripeInvoice && (
                  <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#F5F1E8" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-black" style={mFont}>Facture Stripe</p>
                      <StatusBadge
                        variant={order.status === "paid" ? "paid" : "invoiced"}
                        customLabel={order.status === "paid" ? "Payée" : "Envoyée"}
                      />
                    </div>
                    <p className="text-xs text-[#444] leading-relaxed" style={mFont}>
                      La facture a été envoyée par mail au client. Vous serez
                      crédité du montant dû (hors commission) dès qu&apos;il
                      paiera par carte ou virement.
                    </p>
                    {order.stripe_hosted_invoice_url && (
                      <a
                        href={order.stripe_hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#1A3A52] hover:text-white transition-colors"
                        style={mFont}
                      >
                        <ExternalLink size={12} />
                        Voir la facture
                      </a>
                    )}
                  </div>
                )}

                {/* Bouton qui ouvre le PDF du devis */}
                <QuoteViewerButton caterer={catererInfo} data={previewData} />

                {/* Totaux */}
                <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6B7280]" style={mFont}>Total HT</p>
                    <p className="text-xs font-bold text-black" style={mFont}>{fmt(totalHT)}</p>
                  </div>
                  {Object.entries(tvaMap).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
                    <div key={rate} className="flex items-center justify-between">
                      <p className="text-xs text-[#6B7280]" style={mFont}>TVA {rate} %</p>
                      <p className="text-xs text-[#6B7280]" style={mFont}>{fmt(amount)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 mt-1" style={{ borderTop: "1px solid #E5E7EB" }}>
                    <p className="text-sm font-bold text-black" style={mFont}>Total TTC</p>
                    <p className="text-base font-bold" style={{ color: "#1A3A52", ...mFont }}>
                      {fmt(totalTTC)}
                    </p>
                  </div>
                  {qr.guest_count > 0 && (
                    <p className="text-[10px] text-[#9CA3AF] text-right mt-0.5" style={mFont}>
                      soit {fmt(totalTTC / qr.guest_count)} / personne
                    </p>
                  )}
                </div>

                {/* Action bouton — selon statut.
                    Le passage en "delivered" déclenche aussi la
                    génération de la facture Stripe côté server, ce qui
                    peut prendre ~1-2 s (création customer + invoice +
                    finalize + send). SubmitButton affiche un spinner
                    en attendant. */}
                {transition && (
                  <form action={advanceStatus}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="nextStatus" value={transition.next} />
                    <SubmitButton
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                      style={{ ...mFont, backgroundColor: "#1A3A52" }}
                      pendingLabel="Mise à jour en cours…"
                    >
                      {transition.label}
                    </SubmitButton>
                  </form>
                )}
                {order.status === "delivered" && !hasStripeInvoice && (
                  // Filet de sécurité : génération auto à la livraison a
                  // échoué — retry manuel.
                  <form action={triggerInvoiceGeneration} className="flex flex-col gap-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <p className="text-xs text-[#9CA3AF]" style={mFont}>
                      La facture n&apos;a pas encore pu être émise automatiquement.
                    </p>
                    <SubmitButton
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                      style={{ ...mFont, backgroundColor: "#1A3A52" }}
                      pendingLabel="Émission en cours…"
                    >
                      Émettre la facture
                    </SubmitButton>
                  </form>
                )}

                {/* Lien vers la demande initiale — toujours tout en bas */}
                <Link
                  href={`/caterer/requests/${qr.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                  style={mFont}
                >
                  <FileText size={13} />
                  Voir la demande initiale
                </Link>
              </div>

              {/* Carte client */}
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

              {/* Livraison */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Livraison
                </p>
                <div className="flex flex-col gap-3">
                  <IconRow icon={Calendar} label="Date" value={fmtDate(order.delivery_date)} />
                  <IconRow icon={Truck} label="Adresse" value={order.delivery_address} />
                </div>
                {order.notes && (
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{ backgroundColor: "#F5F1E8", color: "#000", ...mFont }}
                  >
                    <span className="font-bold">Notes · </span>
                    {order.notes}
                  </div>
                )}
              </div>
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
      <span className="text-sm font-bold text-black truncate min-w-0" style={mFont}>
        {value}
      </span>
    </div>
  );
}
