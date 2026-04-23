"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, Info, Lock } from "lucide-react";
import { saveQuote } from "@/app/(dashboard)/caterer/requests/[id]/quote/new/actions";
import type { QuoteRequest } from "@/types/database";
import QuotePreviewModal from "@/components/caterer/QuotePreviewModal";
import type { CatererInfo, ClientInfo } from "@/components/caterer/QuotePreviewModal";
import BackButton from "@/components/ui/BackButton";
import { randomUUID } from "@/lib/uuid";
import {
  PLATFORM_FEE_LABEL,
  PLATFORM_FEE_RATE_DISPLAY,
  PLATFORM_FEE_TVA_RATE,
  computePlatformFeeHt,
  computePlatformFeeTva,
  computePlatformFeeTtc,
} from "@/lib/stripe/constants";

// ── Types ─────────────────────────────────────────────────────

type LineItem = {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
};

type SectionKey = "main" | "drinks" | "extra";
type Sections = Record<SectionKey, LineItem[]>;

// ── Constants ─────────────────────────────────────────────────

const MEAL_TYPE_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner",
  diner: "Dîner",
  cocktail: "Cocktail dinatoire",
  petit_dejeuner: "Petit déjeuner",
  autre: "Apéritif",
  pause_gourmande: "Pause gourmande",
  plateaux_repas: "Plateaux repas",
  cocktail_dinatoire: "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif: "Cocktail apéritif",
};

const DIETARY_LABELS: { key: keyof QuoteRequest; label: string }[] = [
  { key: "dietary_vegetarian", label: "Végétarien" },
  { key: "dietary_vegan", label: "Vegan" },
  { key: "dietary_halal", label: "Halal" },
  { key: "dietary_kosher", label: "Casher" },
  { key: "dietary_gluten_free", label: "Sans gluten" },
];

// ── Helpers ───────────────────────────────────────────────────

function newItem(): LineItem {
  return {
    id: randomUUID(),
    label: "",
    description: "",
    quantity: 1,
    unit_price_ht: 0,
    tva_rate: 10,
  };
}

function formatCurrency(n: number) {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#1A3A52] transition-colors bg-white";
const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };
const inputStyle = { ...mFont, color: "#1A1A1A" };

// ── Card ──────────────────────────────────────────────────────

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
      <h2
        className="font-display font-bold text-xl text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── InfoCard ──────────────────────────────────────────────────

function InfoCard({
  reference,
  validUntil,
  onVU,
}: {
  reference: string;
  validUntil: string;
  onVU: (v: string) => void;
}) {
  return (
    <Card title="Informations du devis">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-black" style={mFont}>
            Référence du devis
          </label>
          <div className="relative">
            <input
              value={reference}
              readOnly
              disabled
              className={inputCls}
              style={{
                ...inputStyle,
                backgroundColor: "#F3F4F6",
                color: "#6B7280",
                cursor: "not-allowed",
                paddingRight: 32,
              }}
              aria-describedby="reference-locked-hint"
            />
            <Lock
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
          </div>
          <p
            id="reference-locked-hint"
            className="text-[11px] text-[#6B7280] leading-snug"
            style={mFont}
          >
            La référence est générée automatiquement et ne peut pas être
            modifiée.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-black" style={mFont}>
            Date de validité
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => onVU(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </Card>
  );
}

// ── LineItemRow ───────────────────────────────────────────────

function LineItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: LineItem;
  onUpdate: (field: keyof LineItem, value: unknown) => void;
  onRemove: () => void;
}) {
  const total = item.quantity * item.unit_price_ht;

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className="flex gap-2 items-center">
        {/* Label */}
        <input
          value={item.label}
          onChange={(e) => onUpdate("label", e.target.value)}
          className={inputCls + " flex-1 min-w-0"}
          style={inputStyle}
          placeholder="Libellé *"
        />
        {/* Quantité */}
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) =>
            onUpdate("quantity", Math.max(1, Number(e.target.value)))
          }
          className={inputCls}
          style={{ ...inputStyle, width: 64, textAlign: "right" }}
          placeholder="Qté"
        />
        {/* PU HT */}
        <div className="relative shrink-0" style={{ width: 96 }}>
          <input
            type="number"
            min={0}
            step={0.01}
            value={item.unit_price_ht || ""}
            onChange={(e) => onUpdate("unit_price_ht", Number(e.target.value))}
            className={inputCls}
            style={{ ...inputStyle, paddingRight: 24, textAlign: "right" }}
            placeholder="0.00"
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF] pointer-events-none"
            style={mFont}
          >
            €
          </span>
        </div>
        {/* TVA */}
        <select
          value={item.tva_rate}
          onChange={(e) => onUpdate("tva_rate", Number(e.target.value))}
          className={inputCls}
          style={{ ...inputStyle, width: 80 }}
        >
          <option value={5.5}>5,5 %</option>
          <option value={10}>10 %</option>
          <option value={20}>20 %</option>
        </select>
        {/* Total HT (read-only) */}
        <div
          className="flex items-center justify-end px-3 py-2 rounded-lg text-sm font-bold shrink-0"
          style={{
            width: 96,
            backgroundColor: "#F9FAFB",
            color: "#1A3A52",
            ...mFont,
          }}
        >
          {formatCurrency(total)}
        </div>
        {/* Supprimer */}
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-[#FEF2F2] transition-colors shrink-0"
        >
          <Trash2 size={14} className="text-[#DC2626]" />
        </button>
      </div>
      {/* Description optionnelle */}
      <input
        value={item.description}
        onChange={(e) => onUpdate("description", e.target.value)}
        className={inputCls}
        style={{ ...mFont, fontSize: 12, color: "#6B7280" }}
        placeholder="Description optionnelle"
      />
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────

function SectionCard({
  title,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  items: LineItem[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof LineItem, value: unknown) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card title={title}>
      {items.length > 0 && (
        <div>
          {/* En-têtes colonnes */}
          <div className="flex gap-2 items-center pb-2 border-b border-[#E5E7EB]">
            <p
              className="flex-1 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={mFont}
            >
              Libellé
            </p>
            <p
              className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={{ ...mFont, width: 64, textAlign: "right" }}
            >
              Qté
            </p>
            <p
              className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={{ ...mFont, width: 96, textAlign: "right" }}
            >
              PU HT
            </p>
            <p
              className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={{ ...mFont, width: 80, textAlign: "center" }}
            >
              TVA
            </p>
            <p
              className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={{ ...mFont, width: 96, textAlign: "right" }}
            >
              Total HT
            </p>
            <div style={{ width: 36 }} />
          </div>
          {items.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              onUpdate={(field, val) => onUpdate(item.id, field, val)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 text-sm font-bold text-[#1A3A52] hover:opacity-70 transition-opacity self-start"
        style={mFont}
      >
        <span className="w-5 h-5 rounded-full bg-[#1A3A52] flex items-center justify-center shrink-0">
          <Plus size={11} className="text-white" />
        </span>
        Ajouter une ligne
      </button>
    </Card>
  );
}

// ── NotesCard ─────────────────────────────────────────────────

function NotesCard({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card title="Notes et conditions">
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={inputCls}
        style={{ ...inputStyle, resize: "vertical" }}
        placeholder="Conditions particulières, délais de paiement, remarques…"
      />
    </Card>
  );
}

// ── TotalCard ─────────────────────────────────────────────────

function TotalCard({
  totalHT,
  tvaMap,
  totalTVA,
  totalTTC,
  guestCount,
  onDraft,
  onSend,
  isPending,
  savedDraft,
  canSend,
  error,
}: {
  totalHT: number;
  tvaMap: Record<number, number>;
  totalTVA: number;
  totalTTC: number;
  guestCount: number;
  onDraft: () => void;
  onSend: () => void;
  isPending: boolean;
  savedDraft: boolean;
  canSend: boolean;
  error: string | null;
}) {
  const perPerson = guestCount > 0 && totalTTC > 0 ? totalTTC / guestCount : null;

  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
      <h2
        className="font-display font-bold text-lg text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        Total du devis
      </h2>

      <div className="flex flex-col gap-3">
        {/* Bloc prestation traiteur */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]" style={mFont}>
            Prestation traiteur
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6B7280]" style={mFont}>Total HT</p>
            <p className="text-xs text-black" style={mFont}>{formatCurrency(totalHT)}</p>
          </div>
          {Object.entries(tvaMap)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([rate, amount]) => (
              <div key={rate} className="flex items-center justify-between">
                <p className="text-xs text-[#6B7280]" style={mFont}>TVA {rate} %</p>
                <p className="text-xs text-[#6B7280]" style={mFont}>{formatCurrency(amount)}</p>
              </div>
            ))}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</p>
            <p className="text-xs font-bold text-black" style={mFont}>{formatCurrency(totalTTC)}</p>
          </div>
          {perPerson && (
            <p className="text-[10px] text-[#9CA3AF] text-right" style={mFont}>
              soit {formatCurrency(perPerson)} / personne
            </p>
          )}
        </div>

        {/* Bloc frais de mise en relation */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-1" style={mFont}>
            {PLATFORM_FEE_LABEL} ({Math.round(PLATFORM_FEE_RATE_DISPLAY * 100)}% ajoutés)
            <span className="group relative inline-flex items-center">
              <Info size={11} className="text-[#9CA3AF] cursor-help" />
              <span
                className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 rounded shadow-lg z-10 text-[11px] font-normal normal-case tracking-normal leading-snug"
                style={{ backgroundColor: "#1A3A52", color: "#FFF", ...mFont }}
                role="tooltip"
              >
                Ces frais sont ajoutés sur la facture du client et
                reviennent à la plateforme.
                <span
                  className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "5px solid #1A3A52",
                  }}
                />
              </span>
            </span>
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6B7280]" style={mFont}>Montant HT</p>
            <p className="text-xs text-black" style={mFont}>{formatCurrency(computePlatformFeeHt(totalHT))}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6B7280]" style={mFont}>TVA {PLATFORM_FEE_TVA_RATE} %</p>
            <p className="text-xs text-[#6B7280]" style={mFont}>{formatCurrency(computePlatformFeeTva(totalHT))}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-black" style={mFont}>Sous-total TTC</p>
            <p className="text-xs font-bold text-black" style={mFont}>{formatCurrency(computePlatformFeeTtc(totalHT))}</p>
          </div>
        </div>

        {/* Total à payer (plus de liseré navy — le montant se détache
            naturellement par sa taille et sa couleur) */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-black" style={mFont}>Total à payer</p>
          <p className="text-xl font-bold" style={{ color: "#1A3A52", ...mFont }}>
            {formatCurrency(totalTTC + computePlatformFeeTtc(totalHT))}
          </p>
        </div>
      </div>

      {/* Actions : remplace l'ancienne barre sticky du bas. En cas
          d'erreur, on l'affiche juste au dessus pour rester proche
          du bouton qui l'a déclenchée. */}
      {error && (
        <p className="text-xs text-[#DC2626]" style={mFont}>
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={isPending || !canSend}
          className="w-full px-4 py-2.5 rounded-full text-xs font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ ...mFont, backgroundColor: "#1A3A52" }}
        >
          Enregistrer et envoyer
        </button>
        <button
          type="button"
          onClick={onDraft}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold border border-[#1A3A52] text-[#1A3A52] hover:bg-[#F0F4F7] transition-colors disabled:opacity-50"
          style={mFont}
        >
          {savedDraft ? (
            <>
              <Check size={13} /> Brouillon enregistré
            </>
          ) : (
            "Enregistrer en brouillon"
          )}
        </button>
      </div>
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 items-start">
      <p className="flex-1 text-xs text-[#666]" style={mFont}>
        {label}
      </p>
      <p className="flex-1 text-xs font-bold text-black" style={mFont}>
        {value}
      </p>
    </div>
  );
}

function SummaryCard({ request }: { request: QuoteRequest }) {
  const diets = DIETARY_LABELS.filter(
    (d) => request[d.key as keyof QuoteRequest] === true
  );

  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
      <h2
        className="font-display font-bold text-lg text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        Récapitulatif de la demande
      </h2>

      <div className="flex flex-col gap-2">
        <SummaryRow
          label="Type"
          value={MEAL_TYPE_LABELS[request.meal_type ?? ""] ?? request.meal_type}
        />
        <SummaryRow label="Date" value={formatDate(request.event_date)} />
        {(request.event_start_time || request.event_end_time) && (
          <SummaryRow
            label="Horaires"
            value={[request.event_start_time, request.event_end_time]
              .filter(Boolean)
              .join(" – ")}
          />
        )}
        <SummaryRow label="Lieu" value={request.event_address} />
        <SummaryRow
          label="Convives"
          value={`${request.guest_count} personnes`}
        />
      </div>

      <div className="h-px bg-[#E0E0E0]" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-black" style={mFont}>
          Budget
        </p>
        {request.budget_global ? (
          <SummaryRow
            label="Global"
            value={formatCurrency(request.budget_global)}
          />
        ) : null}
        {request.budget_per_person ? (
          <SummaryRow
            label="Par personne"
            value={formatCurrency(request.budget_per_person)}
          />
        ) : null}
        {!request.budget_global && !request.budget_per_person && (
          <p className="text-xs text-[#9CA3AF]" style={mFont}>
            Non renseigné
          </p>
        )}
      </div>

      {request.drinks_included && request.drinks_details && (
        <>
          <div className="h-px bg-[#E0E0E0]" />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold text-black" style={mFont}>
              Boissons
            </p>
            <div className="flex flex-col gap-1">
              {(request.drinks_details ?? "")
                .split(",")
                .map((d) => d.trim())
                .filter((d) => d.length > 0)
                .map((drink, i) => (
                  <p key={i} className="text-xs text-[#666]" style={mFont}>
                    {drink}
                  </p>
                ))}
            </div>
          </div>
        </>
      )}

      {diets.length > 0 && (
        <>
          <div className="h-px bg-[#E0E0E0]" />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-black" style={mFont}>
              Contraintes alimentaires
            </p>
            {diets.map((d) => (
              <SummaryRow key={String(d.key)} label={d.label} value="Oui" />
            ))}
            {request.dietary_other && (
              <SummaryRow label="Autres" value={request.dietary_other} />
            )}
          </div>
        </>
      )}

      {request.description && (
        <>
          <div className="h-px bg-[#E0E0E0]" />
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold text-black" style={mFont}>
              Message du client
            </p>
            <p
              className="text-xs text-[#666] italic leading-relaxed"
              style={mFont}
            >
              {request.description}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers : init sections depuis un brouillon ───────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initSectionsFromDetails(details: any[]): Sections {
  const sections: Sections = { main: [], drinks: [], extra: [] };
  for (const d of details) {
    const section: SectionKey =
      d.section === "drinks" ? "drinks" : d.section === "extra" ? "extra" : "main";
    sections[section].push({
      id: randomUUID(),
      label: d.label ?? "",
      description: d.description ?? "",
      quantity: d.quantity ?? 1,
      unit_price_ht: d.unit_price_ht ?? 0,
      tva_rate: d.tva_rate ?? 10,
    });
  }
  return sections;
}

// ── Main component ────────────────────────────────────────────

type DraftQuote = {
  id: string;
  reference: string;
  valid_until: string | null;
  notes: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any[];
};

interface QuoteEditorProps {
  request: QuoteRequest;
  requestId: string;
  defaultReference: string;
  draftQuote?: DraftQuote;
  catererInfo: CatererInfo;
  clientInfo?: ClientInfo | null;
}

export default function QuoteEditor({
  request,
  requestId,
  defaultReference,
  draftQuote,
  catererInfo,
  clientInfo = null,
}: QuoteEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedDraft, setSavedDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // La référence est gelée (générée par le système, ne peut pas être
  // modifiée — elle sert de numéro de facture Stripe, unicité imposée).
  const [reference] = useState(draftQuote?.reference ?? defaultReference);
  // Track du quote id courant — initialisé à l'id du draft si on entre
  // en edit mode, mis à jour quand on sauve un nouveau devis en
  // brouillon pour que les saves suivants deviennent des UPDATE (sans
  // ça on retomberait sur un INSERT à chaque clic, bloqué par la
  // contrainte d'unicité sur la référence).
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(
    draftQuote?.id ?? null
  );
  const [validUntil, setValidUntil] = useState(draftQuote?.valid_until ?? "");
  const [notes, setNotes] = useState(draftQuote?.notes ?? "");
  const [sections, setSections] = useState<Sections>(() =>
    draftQuote?.details.length
      ? initSectionsFromDetails(draftQuote.details)
      : { main: [], drinks: [], extra: [] }
  );

  // ── Totals
  const allItems = [
    ...sections.main,
    ...sections.drinks,
    ...sections.extra,
  ];
  const totalHT = allItems.reduce(
    (s, i) => s + i.quantity * i.unit_price_ht,
    0
  );
  const tvaMap: Record<number, number> = {};
  for (const item of allItems) {
    const ht = item.quantity * item.unit_price_ht;
    tvaMap[item.tva_rate] = (tvaMap[item.tva_rate] ?? 0) + (ht * item.tva_rate) / 100;
  }
  const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v, 0);
  const totalTTC = totalHT + totalTVA;

  // ── Mutations
  function addItem(section: SectionKey) {
    setSections((p) => ({ ...p, [section]: [...p[section], newItem()] }));
  }

  function updateItem(
    section: SectionKey,
    id: string,
    field: keyof LineItem,
    value: unknown
  ) {
    setSections((p) => ({
      ...p,
      [section]: p[section].map((i) =>
        i.id === id ? { ...i, [field]: value } : i
      ),
    }));
  }

  function removeItem(section: SectionKey, id: string) {
    setSections((p) => ({
      ...p,
      [section]: p[section].filter((i) => i.id !== id),
    }));
  }

  // ── Save
  function buildPayload() {
    return {
      quote_request_id: requestId,
      ...(currentQuoteId ? { quote_id: currentQuoteId } : {}),
      reference,
      valid_until: validUntil || null,
      notes,
      guest_count: request.guest_count,
      items: [
        ...sections.main.map((i) => ({ ...i, section: "main" as const })),
        ...sections.drinks.map((i) => ({ ...i, section: "drinks" as const })),
        ...sections.extra.map((i) => ({ ...i, section: "extra" as const })),
      ],
    };
  }

  function handleDraft() {
    setError(null);
    startTransition(async () => {
      const result = await saveQuote(buildPayload(), false);
      if (result.error) {
        setError(result.error);
      } else {
        if (result.id) setCurrentQuoteId(result.id);
        setSavedDraft(true);
        setTimeout(() => setSavedDraft(false), 3000);
      }
    });
  }

  function handleSend() {
    setError(null);
    setShowPreview(true);
  }

  function handleConfirmSend() {
    setError(null);
    startTransition(async () => {
      const result = await saveQuote(buildPayload(), true);
      if (result.error) {
        setShowPreview(false);
        setError(result.error);
      } else {
        router.push(`/caterer/requests/${requestId}`);
      }
    });
  }

  const previewData = {
    reference,
    validUntil,
    notes,
    items: [
      ...sections.main.map((i) => ({ ...i, section: "main" as const })),
      ...sections.drinks.map((i) => ({ ...i, section: "drinks" as const })),
      ...sections.extra.map((i) => ({ ...i, section: "extra" as const })),
    ],
    totalHT,
    tvaMap,
    totalTVA,
    totalTTC,
    guestCount: request.guest_count,
    eventDate: request.event_date,
    eventAddress: request.event_address,
    mealTypeLabel: MEAL_TYPE_LABELS[request.meal_type ?? ""] ?? request.meal_type,
    client: clientInfo,
  };

  return (
    <>
      {showPreview && (
        <QuotePreviewModal
          caterer={catererInfo}
          data={previewData}
          onClose={() => setShowPreview(false)}
          onConfirm={handleConfirmSend}
          isPending={isPending}
        />
      )}
      <main
        className="flex-1"
        style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
      >
      <div className="pt-[54px] px-6 pb-8">
        <div className="mx-auto" style={{ maxWidth: "1020px" }}>
          <div className="mb-4">
            <BackButton label="Retour à la demande" />
          </div>

          <h1
            className="font-display font-bold text-4xl mb-6 text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            {draftQuote ? "Modifier le brouillon" : "Créer un devis"} —{" "}
            <span className="text-[#9CA3AF]">
              demande #{requestId.slice(0, 8).toUpperCase()}
            </span>
          </h1>

          <div className="flex gap-6">
            {/* Formulaire */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              <InfoCard
                reference={reference}
                validUntil={validUntil}
                onVU={setValidUntil}
              />
              <SectionCard
                title="Prestations principales"
                items={sections.main}
                onAdd={() => addItem("main")}
                onUpdate={(id, f, v) => updateItem("main", id, f, v)}
                onRemove={(id) => removeItem("main", id)}
              />
              <SectionCard
                title="Boissons"
                items={sections.drinks}
                onAdd={() => addItem("drinks")}
                onUpdate={(id, f, v) => updateItem("drinks", id, f, v)}
                onRemove={(id) => removeItem("drinks", id)}
              />
              <SectionCard
                title="Prestations complémentaires"
                items={sections.extra}
                onAdd={() => addItem("extra")}
                onUpdate={(id, f, v) => updateItem("extra", id, f, v)}
                onRemove={(id) => removeItem("extra", id)}
              />
              <NotesCard notes={notes} onChange={setNotes} />
            </div>

            {/* Sidebar : total (sticky, en haut) + récapitulatif demande */}
            <div
              className="shrink-0 self-start sticky flex flex-col gap-4"
              style={{ width: 300, top: 72 }}
            >
              <TotalCard
                totalHT={totalHT}
                tvaMap={tvaMap}
                totalTVA={totalTVA}
                totalTTC={totalTTC}
                guestCount={request.guest_count}
                onDraft={handleDraft}
                onSend={handleSend}
                isPending={isPending}
                savedDraft={savedDraft}
                canSend={allItems.length > 0}
                error={error}
              />
              <SummaryCard request={request} />
            </div>
          </div>
        </div>
      </div>
      </main>
    </>
  );
}
