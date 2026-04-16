import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function due30Str() {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const SECTION_TITLES: Record<string, string> = {
  main: "Prestations principales",
  drinks: "Boissons",
  extra: "Prestations complémentaires",
};

export default async function CatererInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase
    .from("users").select("caterer_id").eq("id", user!.id).single();
  const catererId = (profileData as { caterer_id: string | null } | null)?.caterer_id ?? "";

  const { data: orderData } = await supabase
    .from("orders")
    .select(`
      id, status, delivery_date,
      quotes!inner (
        id, reference, total_amount_ht, details, notes, caterer_id,
        quote_requests!inner (
          title, guest_count, meal_type,
          companies ( name ),
          users ( first_name, last_name )
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!orderData) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderData as any;
  if (order.quotes?.caterer_id !== catererId) notFound();
  if (order.status !== "delivered") redirect(`/caterer/orders/${id}`);

  const { data: existingInvoice } = await supabase
    .from("invoices").select("id").eq("order_id", id).maybeSingle();
  if (existingInvoice) redirect(`/caterer/orders/${id}`);

  // Compute totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = order.quotes.details ?? [];
  const totalHT: number = order.quotes.total_amount_ht;
  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const ht = (item.quantity ?? 1) * (item.unit_price_ht ?? 0);
    tvaMap[item.tva_rate] = (tvaMap[item.tva_rate] ?? 0) + (ht * item.tva_rate) / 100;
  }
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
  const totalTTC = totalHT + totalTVA;
  const blendedTvaRate = totalHT > 0 ? totalTVA / totalHT : 0.1;

  const qr = order.quotes.quote_requests;
  const companyName: string = qr?.companies?.name ?? "—";
  const clientUser = qr?.users;
  const clientName = clientUser
    ? `${clientUser.first_name ?? ""} ${clientUser.last_name ?? ""}`.trim() || null
    : null;
  const quoteRef: string | null = order.quotes.reference;
  const guestCount: number = qr?.guest_count ?? 0;

  // Sections
  const sections: Record<string, typeof items> = { main: [], drinks: [], extra: [] };
  for (const item of items) {
    (sections[item.section ?? "main"] ??= []).push(item);
  }

  // ── Server action ──────────────────────────────────────────
  async function createInvoice(formData: FormData) {
    "use server";
    const esat_invoice_ref = (formData.get("esat_invoice_ref") as string)?.trim() || null;
    const issued_at_raw = formData.get("issued_at") as string;
    const due_at_raw = formData.get("due_at") as string;

    const sb = await createClient();
    const { data: { user: u } } = await sb.auth.getUser();
    const { data: pd } = await sb.from("users").select("caterer_id").eq("id", u!.id).single();
    const cId = (pd as { caterer_id: string | null } | null)?.caterer_id ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("invoices").insert({
      order_id: id,
      caterer_id: cId,
      esat_invoice_ref,
      amount_ht: totalHT,
      tva_rate: blendedTvaRate,
      amount_ttc: totalTTC,
      issued_at: issued_at_raw ? new Date(issued_at_raw).toISOString() : new Date().toISOString(),
      due_at: due_at_raw ? new Date(due_at_raw).toISOString() : null,
      status: "pending",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from("orders").update({ status: "invoiced" }).eq("id", id);
    redirect(`/caterer/orders/${id}`);
  }

  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Back */}
          <BackButton label="Retour" />

          {/* Title */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            {qr?.title}
          </h1>

          {/* Two-column layout */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Left : prestations ── */}
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6">
              <p
                className="font-display font-bold text-xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
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
                            <th
                              key={h}
                              className="pb-2 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
                              style={{ ...mFont, textAlign: i === 0 ? "left" : "right" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {sections[key].map((item: any, i: number) => (
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
                {Object.entries(tvaMap).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
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
                {guestCount > 0 && (
                  <p className="text-xs text-[#9CA3AF]" style={mFont}>
                    soit {fmt(totalTTC / guestCount)} / personne
                  </p>
                )}
              </div>

              {order.quotes.notes && (
                <>
                  <div className="border-t border-[#f2f2f2]" />
                  <div className="flex flex-col gap-2">
                    <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                      Notes et conditions
                    </p>
                    <p className="text-xs text-[#444] leading-relaxed whitespace-pre-wrap" style={mFont}>{order.quotes.notes}</p>
                  </div>
                </>
              )}
            </div>

            {/* ── Right : action panel ── */}
            <form
              action={createInvoice}
              className="bg-white rounded-lg p-6 flex flex-col gap-6 w-full md:w-[324px] md:shrink-0"
            >
              {/* Company + contact */}
              <div className="flex flex-col gap-2">
                <Building2 size={24} className="text-[#C4714A]" />
                <p
                  className="font-display font-bold text-2xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  {companyName}
                </p>
                {clientName && (
                  <div
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-[#313131] w-fit"
                    style={{ backgroundColor: "#F5F1E8", fontFamily: "Marianne, system-ui, sans-serif" }}
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

              {/* Montants */}
              <div className="flex flex-col gap-4">
                <Row label="Montant HT" value={fmt(totalHT)} />
                {Object.entries(tvaMap).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
                  <Row key={rate} label={`TVA ${rate} %`} value={fmt(amount)} />
                ))}
                <Row label="Total TTC" value={fmt(totalTTC)} bold />
                {guestCount > 0 && (
                  <Row label="Par personne" value={fmt(totalTTC / guestCount)} />
                )}
                {quoteRef && <Row label="Réf. devis" value={quoteRef} />}
              </div>

              <div className="border-t border-[#f2f2f2]" />

              {/* Champs de facturation */}
              <div className="flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="esat_invoice_ref"
                    className="text-xs text-black block mb-1.5"
                    style={mFont}
                  >
                    Numéro de facture <span className="text-[#9CA3AF]">(optionnel)</span>
                  </label>
                  <input
                    id="esat_invoice_ref"
                    name="esat_invoice_ref"
                    type="text"
                    placeholder="ex. FAC-2025-042"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-xs text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </div>
                <div>
                  <label htmlFor="issued_at" className="text-xs text-black block mb-1.5" style={mFont}>
                    Date d&apos;émission
                  </label>
                  <input
                    id="issued_at"
                    name="issued_at"
                    type="date"
                    defaultValue={todayStr()}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-xs text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </div>
                <div>
                  <label htmlFor="due_at" className="text-xs text-black block mb-1.5" style={mFont}>
                    Date d&apos;échéance
                  </label>
                  <input
                    id="due_at"
                    name="due_at"
                    type="date"
                    defaultValue={due30Str()}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-xs text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                className="flex items-center justify-center px-6 py-4 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#1A3A52", fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Enregistrer la facture
              </button>
            </form>

          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-black" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
        {label}
      </span>
      {value && (
        <span
          className={`text-xs text-right ${bold ? "font-bold text-[#1A3A52]" : "font-bold text-black"}`}
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
