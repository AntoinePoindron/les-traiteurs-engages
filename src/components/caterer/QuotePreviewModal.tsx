"use client";

import React from "react";
import { X, Download, Send } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

export type CatererInfo = {
  name: string;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  siret: string | null;
  logo_url: string | null;
};

type LineItemData = {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
  section: "main" | "drinks" | "extra";
};

export type PreviewData = {
  reference: string;
  validUntil: string;
  notes: string;
  items: LineItemData[];
  totalHT: number;
  tvaMap: Record<number, number>;
  totalTVA: number;
  totalTTC: number;
  guestCount: number;
  eventDate: string;
  eventAddress: string;
  mealTypeLabel: string;
};

interface QuotePreviewModalProps {
  caterer: CatererInfo;
  data: PreviewData;
  onClose: () => void;
  onConfirm?: () => void;
  isPending?: boolean;
  viewOnly?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

function fmt(n: number) {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const SECTION_TITLES: Record<string, string> = {
  main: "Prestations principales",
  drinks: "Boissons",
  extra: "Prestations complémentaires",
};

// ── Print HTML builder ─────────────────────────────────────────

function buildPrintHtml(caterer: CatererInfo, data: PreviewData): string {
  const sections: Record<string, LineItemData[]> = {
    main: [],
    drinks: [],
    extra: [],
  };
  for (const item of data.items) {
    sections[item.section]?.push(item);
  }

  const sectionRows = (["main", "drinks", "extra"] as const)
    .filter((k) => sections[k].length > 0)
    .map((k) => {
      const rows = sections[k]
        .map(
          (item) => `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;vertical-align:top;">
            <strong style="font-size:12px;">${item.label}</strong>
            ${item.description ? `<br/><span style="font-size:11px;color:#888;">${item.description}</span>` : ""}
          </td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${item.quantity}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">${fmt(item.unit_price_ht)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${item.tva_rate} %</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:bold;">${fmt(item.quantity * item.unit_price_ht)}</td>
        </tr>`
        )
        .join("");

      return `
      <tr>
        <td colspan="5" style="padding:12px 6px 4px;background:#f5f5f5;">
          <strong style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#555;">${SECTION_TITLES[k]}</strong>
        </td>
      </tr>
      ${rows}`;
    })
    .join("");

  const tvaRows = Object.entries(data.tvaMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(
      ([rate, amount]) => `
    <tr>
      <td colspan="4" style="text-align:right;padding:3px 6px;font-size:12px;color:#666;">TVA ${rate} %</td>
      <td style="text-align:right;padding:3px 6px;font-size:12px;color:#666;">${fmt(amount)}</td>
    </tr>`
    )
    .join("");

  const perPerson =
    data.guestCount > 0 && data.totalTTC > 0
      ? `<p style="text-align:right;font-size:11px;color:#999;margin:4px 0 0;">soit ${fmt(data.totalTTC / data.guestCount)} / personne</p>`
      : "";

  const notesBlock = data.notes
    ? `
    <div style="margin-top:32px;padding:16px;border:1px solid #eee;border-radius:6px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin:0 0 8px;">Notes et conditions</p>
      <p style="font-size:12px;color:#444;margin:0;white-space:pre-wrap;">${data.notes}</p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Devis ${data.reference}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; background: white; }
  @page { size: A4; margin: 20mm 15mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  table { width: 100%; border-collapse: collapse; }
</style>
</head>
<body style="padding:32px;max-width:794px;margin:0 auto;">

  <!-- En-tête -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #1A3A52;">
    <div>
      <h1 style="font-size:28px;font-weight:bold;color:#1A3A52;margin-bottom:4px;">${caterer.name}</h1>
      ${caterer.address ? `<p style="font-size:12px;color:#666;">${caterer.address}</p>` : ""}
      ${caterer.zip_code || caterer.city ? `<p style="font-size:12px;color:#666;">${[caterer.zip_code, caterer.city].filter(Boolean).join(" ")}</p>` : ""}
      ${caterer.siret ? `<p style="font-size:11px;color:#999;margin-top:4px;">SIRET : ${caterer.siret}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <p style="font-size:22px;font-weight:bold;color:#1A3A52;">DEVIS</p>
      <p style="font-size:14px;font-weight:bold;color:#333;margin-top:4px;">${data.reference}</p>
      ${data.validUntil ? `<p style="font-size:11px;color:#888;margin-top:4px;">Valable jusqu'au ${fmtDate(data.validUntil)}</p>` : ""}
    </div>
  </div>

  <!-- Infos événement -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
    <div style="padding:16px;background:#f8f8f8;border-radius:6px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:8px;">Événement</p>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Type :</strong> ${data.mealTypeLabel}</p>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Date :</strong> ${fmtDate(data.eventDate)}</p>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Lieu :</strong> ${data.eventAddress}</p>
      <p style="font-size:12px;"><strong>Convives :</strong> ${data.guestCount} personnes</p>
    </div>
    <div style="padding:16px;background:#f8f8f8;border-radius:6px;">
      <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#555;margin-bottom:8px;">Récapitulatif</p>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Total HT :</strong> ${fmt(data.totalHT)}</p>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Total TVA :</strong> ${fmt(data.totalTVA)}</p>
      <p style="font-size:13px;font-weight:bold;color:#1A3A52;"><strong>Total TTC :</strong> ${fmt(data.totalTTC)}</p>
    </div>
  </div>

  <!-- Tableau des prestations -->
  <table>
    <thead>
      <tr style="background:#1A3A52;color:white;">
        <th style="padding:10px 6px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Désignation</th>
        <th style="padding:10px 6px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;width:50px;">Qté</th>
        <th style="padding:10px 6px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;width:90px;">PU HT</th>
        <th style="padding:10px 6px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;width:60px;">TVA</th>
        <th style="padding:10px 6px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;width:90px;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${sectionRows}
    </tbody>
    <tfoot>
      <tr><td colspan="5" style="padding:8px 0;"></td></tr>
      <tr>
        <td colspan="4" style="text-align:right;padding:4px 6px;font-size:12px;color:#666;border-top:1px solid #ddd;">Total HT</td>
        <td style="text-align:right;padding:4px 6px;font-size:12px;color:#666;border-top:1px solid #ddd;">${fmt(data.totalHT)}</td>
      </tr>
      ${tvaRows}
      <tr style="background:#f0f4f8;">
        <td colspan="4" style="text-align:right;padding:10px 6px;font-size:14px;font-weight:bold;color:#1A3A52;">Total TTC</td>
        <td style="text-align:right;padding:10px 6px;font-size:14px;font-weight:bold;color:#1A3A52;">${fmt(data.totalTTC)}</td>
      </tr>
    </tfoot>
  </table>

  ${perPerson}
  ${notesBlock}

  <!-- Pied de page -->
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:10px;color:#bbb;">Devis généré par Les Traiteurs Engagés — ${caterer.name}</p>
  </div>

</body>
</html>`;
}

// ── Component ──────────────────────────────────────────────────

export default function QuotePreviewModal({
  caterer,
  data,
  onClose,
  onConfirm,
  isPending = false,
  viewOnly = false,
}: QuotePreviewModalProps) {
  const sections: Record<string, LineItemData[]> = {
    main: [],
    drinks: [],
    extra: [],
  };
  for (const item of data.items) {
    sections[item.section]?.push(item);
  }

  function handleDownloadPdf() {
    const html = buildPrintHtml(caterer, data);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 500);
  }

  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 794, minHeight: 400 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-8 py-5 border-b border-[#E5E7EB] shrink-0"
          style={{ borderRadius: "12px 12px 0 0" }}
        >
          <div>
            <h2
              className="font-display font-bold text-xl text-[#1A3A52]"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Aperçu du devis
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5" style={mFont}>
              Vérifiez le document avant de l&apos;envoyer au client
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
          >
            <X size={18} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* A4-like white sheet */}
          <div
            className="bg-white border border-[#E5E7EB] rounded-lg p-10 mx-auto shadow-sm"
            style={{ maxWidth: 680 }}
          >
            {/* Caterer header */}
            <div
              className="flex justify-between items-start pb-6 mb-8"
              style={{ borderBottom: "2px solid #1A3A52" }}
            >
              <div>
                <p
                  className="font-bold text-2xl text-[#1A3A52]"
                  style={mFont}
                >
                  {caterer.name}
                </p>
                {caterer.address && (
                  <p className="text-xs text-[#6B7280] mt-1" style={mFont}>
                    {caterer.address}
                  </p>
                )}
                {(caterer.zip_code || caterer.city) && (
                  <p className="text-xs text-[#6B7280]" style={mFont}>
                    {[caterer.zip_code, caterer.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {caterer.siret && (
                  <p className="text-[10px] text-[#9CA3AF] mt-1" style={mFont}>
                    SIRET : {caterer.siret}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className="text-xl font-bold text-[#1A3A52]"
                  style={mFont}
                >
                  DEVIS
                </p>
                <p className="text-sm font-bold text-black mt-1" style={mFont}>
                  {data.reference}
                </p>
                {data.validUntil && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1" style={mFont}>
                    Valable jusqu&apos;au {fmtDate(data.validUntil)}
                  </p>
                )}
              </div>
            </div>

            {/* Event info */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "#F8F9FA" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2"
                  style={mFont}
                >
                  Événement
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs" style={mFont}>
                    <span className="font-bold">Type : </span>
                    {data.mealTypeLabel}
                  </p>
                  <p className="text-xs" style={mFont}>
                    <span className="font-bold">Date : </span>
                    {fmtDate(data.eventDate)}
                  </p>
                  <p className="text-xs" style={mFont}>
                    <span className="font-bold">Lieu : </span>
                    {data.eventAddress}
                  </p>
                  <p className="text-xs" style={mFont}>
                    <span className="font-bold">Convives : </span>
                    {data.guestCount} personnes
                  </p>
                </div>
              </div>
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "#F8F9FA" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2"
                  style={mFont}
                >
                  Montants
                </p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <p className="text-xs text-[#666]" style={mFont}>
                      Total HT
                    </p>
                    <p className="text-xs font-bold" style={mFont}>
                      {fmt(data.totalHT)}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-xs text-[#666]" style={mFont}>
                      Total TVA
                    </p>
                    <p className="text-xs" style={mFont}>
                      {fmt(data.totalTVA)}
                    </p>
                  </div>
                  <div
                    className="flex justify-between pt-1 mt-1"
                    style={{ borderTop: "1px solid #E5E7EB" }}
                  >
                    <p
                      className="text-xs font-bold text-[#1A3A52]"
                      style={mFont}
                    >
                      Total TTC
                    </p>
                    <p
                      className="text-xs font-bold text-[#1A3A52]"
                      style={mFont}
                    >
                      {fmt(data.totalTTC)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#1A3A52" }}>
                  <th
                    className="text-left text-white text-[10px] uppercase tracking-wider font-bold py-2.5 px-3"
                    style={mFont}
                  >
                    Désignation
                  </th>
                  <th
                    className="text-center text-white text-[10px] uppercase tracking-wider font-bold py-2.5 px-3"
                    style={{ ...mFont, width: 50 }}
                  >
                    Qté
                  </th>
                  <th
                    className="text-right text-white text-[10px] uppercase tracking-wider font-bold py-2.5 px-3"
                    style={{ ...mFont, width: 90 }}
                  >
                    PU HT
                  </th>
                  <th
                    className="text-center text-white text-[10px] uppercase tracking-wider font-bold py-2.5 px-3"
                    style={{ ...mFont, width: 60 }}
                  >
                    TVA
                  </th>
                  <th
                    className="text-right text-white text-[10px] uppercase tracking-wider font-bold py-2.5 px-3"
                    style={{ ...mFont, width: 90 }}
                  >
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["main", "drinks", "extra"] as const).map((key) => {
                  if (sections[key].length === 0) return null;
                  return (
                    <React.Fragment key={key}>
                      <tr
                        style={{ backgroundColor: "#F3F4F6" }}
                      >
                        <td
                          colSpan={5}
                          className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]"
                          style={mFont}
                        >
                          {SECTION_TITLES[key]}
                        </td>
                      </tr>
                      {sections[key].map((item) => (
                        <tr
                          key={item.id}
                          style={{ borderBottom: "1px solid #F3F4F6" }}
                        >
                          <td
                            className="px-3 py-2.5 align-top"
                            style={mFont}
                          >
                            <p className="text-xs font-bold text-black">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td
                            className="px-3 py-2.5 text-xs text-center text-[#444]"
                            style={mFont}
                          >
                            {item.quantity}
                          </td>
                          <td
                            className="px-3 py-2.5 text-xs text-right text-[#444]"
                            style={mFont}
                          >
                            {fmt(item.unit_price_ht)}
                          </td>
                          <td
                            className="px-3 py-2.5 text-xs text-center text-[#444]"
                            style={mFont}
                          >
                            {item.tva_rate} %
                          </td>
                          <td
                            className="px-3 py-2.5 text-xs text-right font-bold text-black"
                            style={mFont}
                          >
                            {fmt(item.quantity * item.unit_price_ht)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-2" />
                </tr>
                <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-right text-xs text-[#666]"
                    style={mFont}
                  >
                    Total HT
                  </td>
                  <td
                    className="px-3 py-2 text-right text-xs text-[#666]"
                    style={mFont}
                  >
                    {fmt(data.totalHT)}
                  </td>
                </tr>
                {Object.entries(data.tvaMap)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([rate, amount]) => (
                    <tr key={rate}>
                      <td
                        colSpan={4}
                        className="px-3 py-1 text-right text-xs text-[#9CA3AF]"
                        style={mFont}
                      >
                        TVA {rate} %
                      </td>
                      <td
                        className="px-3 py-1 text-right text-xs text-[#9CA3AF]"
                        style={mFont}
                      >
                        {fmt(amount)}
                      </td>
                    </tr>
                  ))}
                <tr style={{ backgroundColor: "#EEF2F6" }}>
                  <td
                    colSpan={4}
                    className="px-3 py-3 text-right text-sm font-bold text-[#1A3A52]"
                    style={mFont}
                  >
                    Total TTC
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-bold text-[#1A3A52]"
                    style={mFont}
                  >
                    {fmt(data.totalTTC)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {data.guestCount > 0 && data.totalTTC > 0 && (
              <p
                className="text-right text-[11px] text-[#9CA3AF] mt-2"
                style={mFont}
              >
                soit {fmt(data.totalTTC / data.guestCount)} / personne
              </p>
            )}

            {/* Notes */}
            {data.notes && (
              <div
                className="mt-8 p-4 rounded-lg border border-[#E5E7EB]"
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2"
                  style={mFont}
                >
                  Notes et conditions
                </p>
                <p
                  className="text-xs text-[#444] leading-relaxed whitespace-pre-wrap"
                  style={mFont}
                >
                  {data.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div
              className="mt-10 pt-4 text-center"
              style={{ borderTop: "1px solid #F3F4F6" }}
            >
              <p className="text-[10px] text-[#D1D5DB]" style={mFont}>
                Devis généré par Les Traiteurs Engagés — {caterer.name}
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between px-8 py-5 border-t border-[#E5E7EB] shrink-0"
          style={{ borderRadius: "0 0 12px 12px" }}
        >
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-full text-sm font-bold text-[#6B7280] hover:text-black transition-colors"
            style={mFont}
          >
            {viewOnly ? "← Fermer" : "← Modifier"}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold border border-[#1A3A52] text-[#1A3A52] hover:bg-[#F0F4F7] transition-colors"
              style={mFont}
            >
              <Download size={14} />
              Télécharger en PDF
            </button>
            {!viewOnly && onConfirm && (
              <button
                onClick={onConfirm}
                disabled={isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ ...mFont, backgroundColor: "#1A3A52" }}
              >
                <Send size={14} />
                {isPending ? "Envoi en cours…" : "Confirmer et envoyer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
