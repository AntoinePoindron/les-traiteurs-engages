import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Printer } from "lucide-react";
import BackButton from "@/components/ui/BackButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const SECTION_TITLES: Record<string, string> = {
  main:   "Prestations principales",
  drinks: "Boissons",
  extra:  "Prestations complémentaires",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default async function ClientInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status, delivery_date, delivery_address,
      quotes!inner (
        id, reference, total_amount_ht, details, notes,
        caterers ( name, address, city, zip_code, siret, logo_url ),
        quote_requests (
          title, event_date, guest_count, service_type, meal_type,
          companies ( name, address, city, zip_code, siret )
        )
      )
    `)
    .eq("id", id)
    .eq("client_admin_id", user!.id)
    .single();

  if (!orderRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoiceRaw } = await (supabase as any)
    .from("invoices")
    .select("id, esat_invoice_ref, amount_ht, amount_ttc, tva_rate, issued_at, due_at, status")
    .eq("order_id", id)
    .maybeSingle();

  if (!invoiceRaw) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order  = orderRaw  as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice = invoiceRaw as any;
  const quote  = order.quotes;
  const caterer = quote?.caterers;
  const qr     = quote?.quote_requests;
  const company = qr?.companies;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(quote?.details) ? quote.details : [];
  const sections: Record<string, typeof items> = { main: [], drinks: [], extra: [] };
  for (const item of items) {
    (sections[item.section ?? "main"] ??= []).push(item);
  }

  const tvaMap: Record<number, number> = {};
  for (const item of items) {
    const ht = (item.quantity ?? 1) * (item.unit_price_ht ?? 0);
    tvaMap[item.tva_rate] = (tvaMap[item.tva_rate] ?? 0) + (ht * item.tva_rate) / 100;
  }
  const totalHT  = Number(invoice.amount_ht);
  const totalTTC = Number(invoice.amount_ttc);
  const totalTVA = totalTTC - totalHT;

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "860px" }}>

          {/* Nav — masquée à l'impression */}
          <div className="flex items-center justify-between print:hidden">
            <BackButton label="Retour" />
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#1A3A52", ...mFont }}
            >
              <Printer size={14} />
              Imprimer / Télécharger PDF
            </button>
          </div>

          {/* Document facture */}
          <div className="bg-white rounded-lg p-10 flex flex-col gap-8">

            {/* En-tête : traiteur + client */}
            <div className="flex items-start justify-between gap-8">
              {/* Traiteur (émetteur) */}
              <div className="flex flex-col gap-2">
                {caterer?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={caterer.logo_url} alt={caterer.name} className="h-10 w-auto max-w-[200px] object-contain mb-1" />
                ) : (
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    {caterer?.name ?? "—"}
                  </p>
                )}
                {caterer?.address && <p className="text-xs text-[#6B7280]" style={mFont}>{caterer.address}</p>}
                {(caterer?.zip_code || caterer?.city) && (
                  <p className="text-xs text-[#6B7280]" style={mFont}>
                    {[caterer.zip_code, caterer.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {caterer?.siret && (
                  <p className="text-xs text-[#9CA3AF]" style={mFont}>SIRET : {caterer.siret}</p>
                )}
              </div>

              {/* Client (destinataire) */}
              <div className="flex flex-col gap-1 text-right">
                <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-1" style={mFont}>Facturé à</p>
                <p className="text-sm font-bold text-black" style={mFont}>{company?.name ?? "—"}</p>
                {company?.address && <p className="text-xs text-[#6B7280]" style={mFont}>{company.address}</p>}
                {(company?.zip_code || company?.city) && (
                  <p className="text-xs text-[#6B7280]" style={mFont}>
                    {[company.zip_code, company.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {company?.siret && (
                  <p className="text-xs text-[#9CA3AF]" style={mFont}>SIRET : {company.siret}</p>
                )}
              </div>
            </div>

            {/* Titre + méta */}
            <div className="flex flex-col gap-2 pb-6" style={{ borderBottom: "2px solid #F3F4F6" }}>
              <h1
                className="font-display font-bold text-3xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Facture
                {invoice.esat_invoice_ref ? ` n° ${invoice.esat_invoice_ref}` : ""}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1">
                {invoice.issued_at && (
                  <span className="text-xs text-[#6B7280]" style={mFont}>
                    Émise le <strong className="text-black">{fmtDate(invoice.issued_at)}</strong>
                  </span>
                )}
                {invoice.due_at && (
                  <span className="text-xs text-[#6B7280]" style={mFont}>
                    Échéance le <strong className="text-black">{fmtDate(invoice.due_at)}</strong>
                  </span>
                )}
                {quote?.reference && (
                  <span className="text-xs text-[#6B7280]" style={mFont}>
                    Réf. devis <strong className="text-black">{quote.reference}</strong>
                  </span>
                )}
                <span className="text-xs text-[#6B7280]" style={mFont}>
                  Événement du <strong className="text-black">{qr?.event_date ? fmtDate(qr.event_date) : "—"}</strong>
                </span>
              </div>
            </div>

            {/* Lignes de prestation */}
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
                          <td className="py-3 text-xs text-right text-[#6B7280]" style={mFont}>{item.quantity}</td>
                          <td className="py-3 text-xs text-right text-[#6B7280]" style={mFont}>{fmt(item.unit_price_ht ?? 0)}</td>
                          <td className="py-3 text-xs text-right text-[#6B7280]" style={mFont}>{item.tva_rate} %</td>
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
            <div className="flex justify-end">
              <div className="flex flex-col gap-2 w-64">
                <div className="flex justify-between">
                  <span className="text-xs text-[#6B7280]" style={mFont}>Total HT</span>
                  <span className="text-sm font-bold text-black" style={mFont}>{fmt(totalHT)}</span>
                </div>
                {Object.entries(tvaMap).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
                  <div key={rate} className="flex justify-between">
                    <span className="text-xs text-[#9CA3AF]" style={mFont}>TVA {rate} %</span>
                    <span className="text-xs text-[#9CA3AF]" style={mFont}>{fmt(amount)}</span>
                  </div>
                ))}
                {Object.keys(tvaMap).length === 0 && totalTVA > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9CA3AF]" style={mFont}>TVA</span>
                    <span className="text-xs text-[#9CA3AF]" style={mFont}>{fmt(totalTVA)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2" style={{ borderTop: "2px solid #1A3A52" }}>
                  <span className="text-sm font-bold text-black" style={mFont}>Total TTC</span>
                  <span className="font-display font-bold text-xl text-[#1A3A52]" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    {fmt(totalTTC)}
                  </span>
                </div>
                {qr?.guest_count > 0 && (
                  <p className="text-[11px] text-[#9CA3AF] text-right" style={mFont}>
                    soit {fmt(totalTTC / qr.guest_count)} / personne
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            {quote?.notes && (
              <div className="flex flex-col gap-2 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
                <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider" style={mFont}>Notes et conditions</p>
                <p className="text-xs text-[#6B7280] whitespace-pre-wrap leading-relaxed" style={mFont}>{quote.notes}</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Styles d'impression */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </main>
  );
}
