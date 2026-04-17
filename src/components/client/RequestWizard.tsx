"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { submitQuoteRequest } from "@/app/(dashboard)/client/requests/new/actions";
import { updateQuoteRequest } from "@/app/(dashboard)/client/requests/[id]/edit/actions";
import type { ServiceTypeConfig } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────

export type WizardData = {
  // Step 1
  serviceType: string;
  isFullDay: boolean;
  serviceTypeSecondary: string;
  // Step 2
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventAddress: string;
  guestCount: string;
  eventDescription: string;
  companyServiceId: string;
  // Step 3
  dietVegetarian: boolean;
  dietVegetarianCount: string;
  dietHalal: boolean;
  dietGlutenFree: boolean;
  dietGlutenFreeCount: string;
  dietBio: boolean;
  dietOther: string;
  // Step 4
  drinksWaterStill: boolean;
  drinksWaterSparkling: boolean;
  drinksSoft: boolean;
  drinksSoftDetails: string;
  drinksAlcohol: boolean;
  drinksAlcoholDetails: string;
  drinksHot: boolean;
  // Step 5
  serviceWaitstaff: boolean;
  serviceEquipment: boolean;
  serviceEquipmentVerres: boolean;
  serviceEquipmentNappes: boolean;
  serviceEquipmentTables: boolean;
  serviceEquipmentOther: string;
  serviceSetup: boolean;
  serviceSetupTime: string;
  serviceSetupOther: string;
  // Step 6
  budgetGlobal: string;
  budgetPerPerson: string;
  budgetFlexibility: string;
  // Step 7
  messageToCaterer: string;
};

// ── Constants ──────────────────────────────────────────────────

const INITIAL: WizardData = {
  serviceType: "", isFullDay: false, serviceTypeSecondary: "",
  eventDate: "", eventStartTime: "", eventEndTime: "", eventAddress: "", guestCount: "", eventDescription: "", companyServiceId: "",
  dietVegetarian: false, dietVegetarianCount: "", dietHalal: false, dietGlutenFree: false, dietGlutenFreeCount: "", dietBio: false, dietOther: "",
  drinksWaterStill: false, drinksWaterSparkling: false, drinksSoft: false, drinksSoftDetails: "", drinksAlcohol: false, drinksAlcoholDetails: "", drinksHot: false,
  serviceWaitstaff: false, serviceEquipment: false, serviceEquipmentVerres: false, serviceEquipmentNappes: false, serviceEquipmentTables: false, serviceEquipmentOther: "", serviceSetup: false, serviceSetupTime: "", serviceSetupOther: "",
  budgetGlobal: "", budgetPerPerson: "", budgetFlexibility: "10",
  messageToCaterer: "",
};

const SERVICE_TYPES = [
  { key: "petit_dejeuner",        label: "Petit déjeuner" },
  { key: "pause_gourmande",       label: "Pause gourmande" },
  { key: "plateaux_repas",        label: "Plateaux repas" },
  { key: "cocktail_dinatoire",    label: "Cocktail dinatoire" },
  { key: "cocktail_dejeunatoire", label: "Cocktail déjeunatoire" },
  { key: "cocktail_aperitif",     label: "Cocktail apéritif" },
];

const STEP_LABELS = [
  "Type de\nprestation",
  "Détail de\nl'événement",
  "Préférences et\ncontraintes",
  "Ajouter des\nboissons",
  "Services\nadditionnels",
  "Votre\nbudget",
  "Récapitulatif\net envoi",
];

const FLEXIBILITY_OPTIONS = [
  { value: "none", label: "Budget fixe" },
  { value: "5",   label: "Flexible (± 5%)" },
  { value: "10",  label: "Flexible (± 10%)" },
];

const SERVICE_TYPE_LABELS: Record<string, string> = {
  petit_dejeuner: "Petit déjeuner", pause_gourmande: "Pause gourmande",
  plateaux_repas: "Plateaux repas", cocktail_dinatoire: "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire", cocktail_aperitif: "Cocktail apéritif",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Sub-components ─────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div className="bg-white rounded-xl p-6">
      <h1
        className="font-display font-bold text-2xl text-black mb-6"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        Demander un devis
      </h1>
      <div className="relative flex items-start">
        {/* Connecting line */}
        <div
          className="absolute top-[18px] left-0 right-0 h-[3px]"
          style={{ backgroundColor: "#E5E7EB", zIndex: 0 }}
        />
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={n} className="flex flex-col items-center flex-1 relative z-10">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: active ? "#E84B3A" : done ? "#1A3A52" : "white",
                  color: active || done ? "white" : "#9CA3AF",
                  border: `2px solid ${active ? "#E84B3A" : done ? "#1A3A52" : "#E5E7EB"}`,
                  ...mFont,
                }}
              >
                {n}
              </div>
              <p
                className="text-center mt-2 leading-tight"
                style={{
                  fontSize: 11,
                  whiteSpace: "pre-line",
                  color: active ? "#1A1A1A" : done ? "#6B7280" : "#9CA3AF",
                  fontWeight: active || done ? 700 : 400,
                  ...mFont,
                }}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-6">
      <h2
        className="font-display font-bold text-xl text-black mb-6"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-bold text-black mb-1.5" style={mFont}>
      {children}
      {required && <span className="text-[#E84B3A] ml-0.5">*</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors ${props.className ?? ""}`}
      style={{ ...mFont, ...props.style }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors resize-none ${props.className ?? ""}`}
      style={{ ...mFont, ...props.style }}
    />
  );
}

function CheckRow({
  label, checked, onChange, children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-b border-[#F3F4F6] last:border-0">
      <div className="flex items-center justify-between py-4">
        <label className="flex items-center gap-3 cursor-pointer select-none flex-1" style={mFont}>
          <span
            className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
            style={{
              border: `2px solid ${checked ? "#E84B3A" : "#D1D5DB"}`,
              backgroundColor: checked ? "#E84B3A" : "white",
            }}
            onClick={() => onChange(!checked)}
          >
            {checked && (
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-sm font-bold text-black">{label}</span>
        </label>
        {children}
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#F3F4F6] last:border-0">
      <span className="text-sm text-[#6B7280]" style={mFont}>{label}</span>
      <span className="text-sm font-bold text-black text-right ml-4" style={mFont}>{value}</span>
    </div>
  );
}

function RecapSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-bold text-black mb-2" style={mFont}>{title}</p>
      {children}
    </div>
  );
}

// ── Step content ───────────────────────────────────────────────

function Step1({
  data, update, catererData,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  catererData: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null;
}) {
  const toggleFullDay = () => {
    update("isFullDay", !data.isFullDay);
    update("serviceType", "");
    update("serviceTypeSecondary", "");
  };

  function toggleService(key: string) {
    if (!data.isFullDay) {
      update("serviceType", key);
    } else {
      if (!data.serviceType) {
        update("serviceType", key);
      } else if (!data.serviceTypeSecondary && key !== data.serviceType) {
        update("serviceTypeSecondary", key);
      } else if (key === data.serviceType) {
        update("serviceType", data.serviceTypeSecondary);
        update("serviceTypeSecondary", "");
      } else if (key === data.serviceTypeSecondary) {
        update("serviceTypeSecondary", "");
      }
    }
  }

  function isSelected(key: string) {
    return key === data.serviceType || key === data.serviceTypeSecondary;
  }

  return (
    <Card title="Quel type de prestation recherchez-vous ?">
      {/* Toggle journée complète */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={toggleFullDay}
          className="relative w-10 h-6 rounded-full transition-colors shrink-0"
          style={{ backgroundColor: data.isFullDay ? "#E84B3A" : "#D1D5DB" }}
          aria-label="Journée complète"
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: data.isFullDay ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
        <span className="text-sm font-bold text-black" style={mFont}>Journée complète</span>
      </div>

      {data.isFullDay && (
        <p className="text-xs text-[#6B7280] mb-4 px-1" style={mFont}>
          Veuillez sélectionner 2 types de prestations
        </p>
      )}

      <div className="flex flex-col">
        {SERVICE_TYPES.map(({ key, label }) => {
          const selected = isSelected(key);
          const cfg = catererData?.service_config?.[key];
          const price = cfg?.price_per_person_min;
          // Grisé si un traiteur est sélectionné et ne propose pas ce type
          const disabled = catererData != null && !cfg?.enabled;
          return (
            <div
              key={key}
              className="flex items-center justify-between py-4 border-b border-[#F3F4F6] last:border-0 transition-opacity"
              style={{
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.38 : 1,
              }}
              onClick={() => !disabled && toggleService(key)}
            >
              <div className="flex items-center gap-3">
                {data.isFullDay ? (
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      border: `2px solid ${selected ? "#E84B3A" : "#D1D5DB"}`,
                      backgroundColor: selected ? "#E84B3A" : "white",
                    }}
                  >
                    {selected && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                ) : (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      border: `2px solid ${selected ? "#E84B3A" : "#D1D5DB"}`,
                    }}
                  >
                    {selected && (
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#E84B3A" }} />
                    )}
                  </span>
                )}
                <div>
                  <span className="text-sm font-bold text-black" style={mFont}>{label}</span>
                  {disabled && (
                    <span className="block text-[11px] text-[#9CA3AF]" style={mFont}>Non proposé par ce traiteur</span>
                  )}
                </div>
              </div>
              {price && !disabled && (
                <span className="text-xs text-[#6B7280]" style={mFont}>
                  à partir de{" "}
                  <span className="font-bold text-[#1A3A52]">{price}€</span>
                  {" "}/ pers
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Step2({
  data,
  update,
  companyServices,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  companyServices: { id: string; name: string }[];
}) {
  return (
    <Card title="Parlez-nous de votre événement">
      <div className="flex flex-col gap-5">
        <div>
          <Label required>Date de l&apos;événement</Label>
          <Input type="date" value={data.eventDate} onChange={e => update("eventDate", e.target.value)} />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Heure de début</Label>
            <Input type="time" value={data.eventStartTime} onChange={e => update("eventStartTime", e.target.value)} placeholder="hh:mm" />
          </div>
          <div className="flex-1">
            <Label>Heure de fin</Label>
            <Input type="time" value={data.eventEndTime} onChange={e => update("eventEndTime", e.target.value)} placeholder="hh:mm" />
          </div>
        </div>
        <div>
          <Label required>Lieu de l&apos;événement</Label>
          <Input type="text" value={data.eventAddress} onChange={e => update("eventAddress", e.target.value)} placeholder="Code postal, adresse complète" />
        </div>
        <div>
          <Label required>Nombre de personnes</Label>
          <Input type="number" min="1" value={data.guestCount} onChange={e => update("guestCount", e.target.value)} placeholder="Ex : 50" />
        </div>
        {companyServices.length > 0 && (
          <div>
            <Label>Service interne rattaché <span className="text-[#9CA3AF] font-normal">(optionnel)</span></Label>
            <select
              value={data.companyServiceId}
              onChange={e => update("companyServiceId", e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black bg-white focus:outline-none focus:border-[#1A3A52] transition-colors"
              style={mFont}
            >
              <option value="">— Aucun service —</option>
              {companyServices.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#9CA3AF]" style={mFont}>
              Permet de suivre cette dépense dans le budget du service.
            </p>
          </div>
        )}
        <div>
          <Label>Type d&apos;événement <span className="text-[#9CA3AF] font-normal">(optionnel)</span></Label>
          <Textarea
            rows={4}
            value={data.eventDescription}
            onChange={e => update("eventDescription", e.target.value)}
            placeholder="Ex : Séminaire, convention, anniversaire d'entreprise..."
          />
        </div>
      </div>
    </Card>
  );
}

function Step3({ data, update }: { data: WizardData; update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <Card title="Préférences et contraintes">
      <div className="flex flex-col">
        <CheckRow label="Options végétariennes" checked={data.dietVegetarian} onChange={v => { update("dietVegetarian", v); if (!v) update("dietVegetarianCount", ""); }}>
          {data.dietVegetarian && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-[#6B7280]" style={mFont}>nbr de pers</span>
              <Input
                type="number" min="1"
                value={data.dietVegetarianCount}
                onChange={e => update("dietVegetarianCount", e.target.value)}
                placeholder="Ex: 5"
                className="w-20"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </CheckRow>
        <CheckRow label="Sans gluten" checked={data.dietGlutenFree} onChange={v => { update("dietGlutenFree", v); if (!v) update("dietGlutenFreeCount", ""); }}>
          {data.dietGlutenFree && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-[#6B7280]" style={mFont}>nbr de pers</span>
              <Input
                type="number" min="1"
                value={data.dietGlutenFreeCount}
                onChange={e => update("dietGlutenFreeCount", e.target.value)}
                placeholder="Ex: 5"
                className="w-20"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </CheckRow>
        <CheckRow label="Halal" checked={data.dietHalal} onChange={v => update("dietHalal", v)} />
        <CheckRow label="Produits bio" checked={data.dietBio} onChange={v => update("dietBio", v)} />
      </div>
      <div className="mt-5">
        <Label>Autres allergies et contraintes <span className="text-[#9CA3AF] font-normal">(optionnel)</span></Label>
        <Textarea
          rows={4}
          value={data.dietOther}
          onChange={e => update("dietOther", e.target.value)}
          placeholder="Allergies, besoins spécifiques, détails logistiques..."
        />
      </div>
    </Card>
  );
}

function Step4({ data, update }: { data: WizardData; update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <Card title="Ajouter des boissons ?">
      <div className="flex flex-col">
        <CheckRow label="Eau plate" checked={data.drinksWaterStill} onChange={v => update("drinksWaterStill", v)} />
        <CheckRow label="Eau gazeuse" checked={data.drinksWaterSparkling} onChange={v => update("drinksWaterSparkling", v)} />
        <CheckRow label="Sodas / Soft" checked={data.drinksSoft} onChange={v => { update("drinksSoft", v); if (!v) update("drinksSoftDetails", ""); }}>
          {data.drinksSoft && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-[#6B7280]" style={mFont}>Précisez</span>
              <Input
                type="text"
                value={data.drinksSoftDetails}
                onChange={e => update("drinksSoftDetails", e.target.value)}
                placeholder="Ex : Jus d'orange"
                className="w-44"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </CheckRow>
        <CheckRow label="Alcool" checked={data.drinksAlcohol} onChange={v => { update("drinksAlcohol", v); if (!v) update("drinksAlcoholDetails", ""); }}>
          {data.drinksAlcohol && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-[#6B7280]" style={mFont}>Précisez</span>
              <Input
                type="text"
                value={data.drinksAlcoholDetails}
                onChange={e => update("drinksAlcoholDetails", e.target.value)}
                placeholder="Ex : Vin rouge"
                className="w-44"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
        </CheckRow>
        <CheckRow label="Thé, Café" checked={data.drinksHot} onChange={v => update("drinksHot", v)} />
      </div>
    </Card>
  );
}

function Step5({ data, update }: { data: WizardData; update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <Card title="Services additionnels">
      <div className="flex flex-col">
        <CheckRow label="Personnel" checked={data.serviceWaitstaff} onChange={v => update("serviceWaitstaff", v)} />

        <CheckRow label="Matériel (vaisselle, nappes, etc.)" checked={data.serviceEquipment} onChange={v => { update("serviceEquipment", v); if (!v) { update("serviceEquipmentVerres", false); update("serviceEquipmentNappes", false); update("serviceEquipmentTables", false); update("serviceEquipmentOther", ""); } }}>
        </CheckRow>
        {data.serviceEquipment && (
          <div className="pl-8 pb-4 flex flex-col gap-3">
            {[
              { key: "serviceEquipmentVerres" as const, label: "Verres" },
              { key: "serviceEquipmentNappes" as const, label: "Nappes et serviettes" },
              { key: "serviceEquipmentTables" as const, label: "Tables" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer" style={mFont}>
                <span
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
                  style={{ border: `2px solid ${data[key] ? "#E84B3A" : "#D1D5DB"}`, backgroundColor: data[key] ? "#E84B3A" : "white" }}
                  onClick={() => update(key, !data[key])}
                >
                  {data[key] && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-black">{label}</span>
              </label>
            ))}
            <div>
              <Label>Autres</Label>
              <Textarea
                rows={3}
                value={data.serviceEquipmentOther}
                onChange={e => update("serviceEquipmentOther", e.target.value)}
                placeholder="Décrivez tout autre matériel nécessaire..."
              />
            </div>
          </div>
        )}

        <CheckRow label="Installation et mise en place" checked={data.serviceSetup} onChange={v => { update("serviceSetup", v); if (!v) { update("serviceSetupTime", ""); update("serviceSetupOther", ""); } }}>
        </CheckRow>
        {data.serviceSetup && (
          <div className="pl-8 pb-4 flex flex-col gap-3">
            <div>
              <Label>Heure de mise en place</Label>
              <Input type="time" value={data.serviceSetupTime} onChange={e => update("serviceSetupTime", e.target.value)} placeholder="hh:mm" className="max-w-[180px]" />
            </div>
            <div>
              <Label>Autres</Label>
              <Textarea
                rows={3}
                value={data.serviceSetupOther}
                onChange={e => update("serviceSetupOther", e.target.value)}
                placeholder="Disposition des tables, contraintes du lieu..."
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Step6({ data, update }: { data: WizardData; update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  const guestCount = parseInt(data.guestCount) || 0;

  // Sync budget fields
  function onGlobalChange(val: string) {
    update("budgetGlobal", val);
    if (val && guestCount > 0) {
      update("budgetPerPerson", (parseFloat(val) / guestCount).toFixed(0));
    }
  }
  function onPerPersonChange(val: string) {
    update("budgetPerPerson", val);
    if (val && guestCount > 0) {
      update("budgetGlobal", (parseFloat(val) * guestCount).toFixed(0));
    }
  }

  const selectedOptions: string[] = [];
  if (data.drinksWaterStill || data.drinksWaterSparkling || data.drinksSoft || data.drinksAlcohol || data.drinksHot) selectedOptions.push("Boissons");
  if (data.serviceWaitstaff) selectedOptions.push("Personnel");
  if (data.serviceEquipment) {
    const items = [data.serviceEquipmentVerres && "Verres", data.serviceEquipmentNappes && "Nappes", data.serviceEquipmentTables && "Tables"].filter(Boolean).join(" + ");
    selectedOptions.push(items ? `Matériel (${items})` : "Matériel");
  }
  if (data.serviceSetup) selectedOptions.push("Installation");

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1">
        <Card title="Votre budget">
          <div className="flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Budget total estimé</Label>
                <div className="relative">
                  <Input
                    type="number" min="0"
                    value={data.budgetGlobal}
                    onChange={e => onGlobalChange(e.target.value)}
                    placeholder="Ex: 2000"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]" style={mFont}>€</span>
                </div>
              </div>
              <div className="w-5 flex items-center justify-center mt-7 text-[#9CA3AF] text-sm shrink-0">↔</div>
              <div className="flex-1">
                <Label>Budget par personne</Label>
                <div className="relative">
                  <Input
                    type="number" min="0"
                    value={data.budgetPerPerson}
                    onChange={e => onPerPersonChange(e.target.value)}
                    placeholder="Ex: 24"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]" style={mFont}>€</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Flexibilité budgétaire</Label>
              <select
                value={data.budgetFlexibility}
                onChange={e => update("budgetFlexibility", e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors appearance-none cursor-pointer"
                style={mFont}
              >
                {FLEXIBILITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Détail */}
      <div className="bg-white rounded-xl p-6 shrink-0" style={{ width: 220 }}>
        <h3 className="font-display font-bold text-base text-black mb-4" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
          Détail
        </h3>
        <div className="flex flex-col gap-2">
          {data.serviceType && (
            <p className="text-sm text-black font-bold" style={mFont}>
              {SERVICE_TYPE_LABELS[data.serviceType]}
            </p>
          )}
          {guestCount > 0 && (
            <p className="text-sm text-[#6B7280]" style={mFont}>{guestCount} personnes</p>
          )}
          {selectedOptions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold text-black mb-1.5" style={mFont}>Options sélectionnées</p>
              <div className="flex flex-col gap-1">
                {selectedOptions.map(o => (
                  <p key={o} className="text-xs text-[#6B7280]" style={mFont}>· {o}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step7({ data, update, catererData, isCompareMode }: {
  data: WizardData;
  update: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  catererData: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null;
  isCompareMode: boolean;
}) {
  const drinks: string[] = [];
  if (data.drinksWaterStill) drinks.push("Eau plate");
  if (data.drinksWaterSparkling) drinks.push("Eau gazeuse");
  if (data.drinksSoft) drinks.push(data.drinksSoftDetails ? `Sodas / Soft (${data.drinksSoftDetails})` : "Sodas / Soft");
  if (data.drinksAlcohol) drinks.push(data.drinksAlcoholDetails ? `Alcool (${data.drinksAlcoholDetails})` : "Alcool");
  if (data.drinksHot) drinks.push("Thé, Café");

  const dietConstraints: string[] = [];
  if (data.dietVegetarian) dietConstraints.push(`Végétarien${data.dietVegetarianCount ? ` — ${data.dietVegetarianCount} pers.` : ""}`);
  if (data.dietGlutenFree) dietConstraints.push(`Sans gluten${data.dietGlutenFreeCount ? ` — ${data.dietGlutenFreeCount} pers.` : ""}`);
  if (data.dietHalal) dietConstraints.push("Halal");
  if (data.dietBio) dietConstraints.push("Produits bio");
  if (data.dietOther) dietConstraints.push(data.dietOther);

  const services: string[] = [];
  if (data.serviceWaitstaff) services.push("Personnel");
  if (data.serviceEquipment) {
    const items = [data.serviceEquipmentVerres && "Verres", data.serviceEquipmentNappes && "Nappes et serviettes", data.serviceEquipmentTables && "Tables"].filter(Boolean).join(", ");
    services.push(items ? `Matériel (${items})` : "Matériel");
  }
  if (data.serviceSetup) services.push(data.serviceSetupTime ? `Installation (à ${data.serviceSetupTime})` : "Installation et mise en place");

  return (
    <Card title="Récapitulatif de votre demande">
      {catererData && !isCompareMode && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm font-bold text-[#1A3A52]" style={{ backgroundColor: "#F0F4F8", ...mFont }}>
          Envoi à : {catererData.name}
        </div>
      )}
      {isCompareMode && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm text-[#6B7280]" style={{ backgroundColor: "#F5F1E8", ...mFont }}>
          Votre demande sera envoyée aux 3 traiteurs les plus pertinents.
        </div>
      )}

      <div>
        <RecapSection title="">
          <RecapRow label="Type de prestation" value={data.serviceType ? (SERVICE_TYPE_LABELS[data.serviceType] + (data.isFullDay && data.serviceTypeSecondary ? ` + ${SERVICE_TYPE_LABELS[data.serviceTypeSecondary]}` : "")) : "—"} />
        </RecapSection>

        <RecapSection title="Détails de l'événement">
          <RecapRow label="Date" value={formatDate(data.eventDate) || "—"} />
          {(data.eventStartTime || data.eventEndTime) && (
            <RecapRow label="Horaires" value={`${data.eventStartTime || "?"}h – ${data.eventEndTime || "?"}h`} />
          )}
          <RecapRow label="Lieu" value={data.eventAddress || "—"} />
          <RecapRow label="Nombre de personnes" value={data.guestCount ? `${data.guestCount} personnes` : "—"} />
        </RecapSection>

        {drinks.length > 0 && (
          <RecapSection title="Boissons">
            {drinks.map(d => <RecapRow key={d} label={d} value="" />)}
          </RecapSection>
        )}

        {dietConstraints.length > 0 && (
          <RecapSection title="Préférences et contraintes alimentaires">
            {dietConstraints.map(d => <RecapRow key={d} label={d} value="" />)}
          </RecapSection>
        )}

        {services.length > 0 && (
          <RecapSection title="Services additionnels">
            {services.map(s => <RecapRow key={s} label={s} value="" />)}
          </RecapSection>
        )}

        {(data.budgetGlobal || data.budgetPerPerson) && (
          <RecapSection title="Budget">
            {data.budgetGlobal && <RecapRow label="Budget total" value={`${data.budgetGlobal} €`} />}
            {data.budgetPerPerson && <RecapRow label="Budget par personne" value={`${data.budgetPerPerson} €`} />}
          </RecapSection>
        )}
      </div>

      <div className="mt-6">
        <Label>Message au traiteur <span className="text-[#9CA3AF] font-normal">(optionnel)</span></Label>
        <Textarea
          rows={4}
          value={data.messageToCaterer}
          onChange={e => update("messageToCaterer", e.target.value)}
          placeholder="Ajoutez des précisions ou des demandes particulières"
        />
      </div>
    </Card>
  );
}

// ── Main wizard ────────────────────────────────────────────────

export default function RequestWizard({
  catererData,
  isCompareMode,
  companyServices = [],
  defaultCompanyServiceId = null,
  editRequestId = null,
  initialData = null,
}: {
  catererData: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null;
  isCompareMode: boolean;
  companyServices?: { id: string; name: string }[];
  defaultCompanyServiceId?: string | null;
  /** When set, the wizard enters edit mode and updates the existing request. */
  editRequestId?: string | null;
  /** Pre-filled data when editing an existing request. */
  initialData?: WizardData | null;
}) {
  const router = useRouter();
  const isEditMode = editRequestId !== null;
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(
    initialData ?? {
      ...INITIAL,
      companyServiceId: defaultCompanyServiceId ?? "",
    }
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditMode && editRequestId) {
        const result = await updateQuoteRequest(editRequestId, data);
        if (!result.ok) {
          setSubmitError(result.error);
          setSubmitting(false);
          return;
        }
        router.push(`/client/requests/${editRequestId}`);
        router.refresh();
      } else {
        await submitQuoteRequest(data, catererData?.id ?? null, isCompareMode);
        const params = new URLSearchParams({ mode: isCompareMode ? "compare" : "direct" });
        if (catererData) params.set("caterer", catererData.name);
        router.push(`/client/requests/confirmation?${params.toString()}`);
      }
    } catch (e) {
      console.error(e);
      setSubmitError(e instanceof Error ? e.message : "Erreur inconnue");
      setSubmitting(false);
    }
  }

  const canProceed = (() => {
    if (step === 1) return !!data.serviceType && (!data.isFullDay || !!data.serviceTypeSecondary);
    if (step === 2) return !!data.eventDate && !!data.eventAddress && !!data.guestCount;
    return true;
  })();

  function handleQuit() {
    if (isEditMode && editRequestId) {
      setQuitConfirmOpen(true);
      return;
    }
    const hasData = data.serviceType || data.eventDate || data.eventAddress || data.guestCount;
    if (hasData) {
      setQuitConfirmOpen(true);
      return;
    }
    router.push("/client/dashboard");
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8" }}>
      <div className="max-w-[720px] mx-auto px-4 pt-8 pb-32">
        <div className="flex flex-col gap-4">
          <BackButton
            label={isEditMode ? "Annuler les modifications" : "Quitter la demande"}
            onClick={handleQuit}
          />
          <Stepper step={step} />

          {step === 1 && <Step1 data={data} update={update} catererData={catererData} />}
          {step === 2 && <Step2 data={data} update={update} companyServices={companyServices} />}
          {step === 3 && <Step3 data={data} update={update} />}
          {step === 4 && <Step4 data={data} update={update} />}
          {step === 5 && <Step5 data={data} update={update} />}
          {step === 6 && <Step6 data={data} update={update} />}
          {step === 7 && <Step7 data={data} update={update} catererData={catererData} isCompareMode={isCompareMode} />}
        </div>
      </div>

      <ConfirmDialog
        open={quitConfirmOpen}
        title={isEditMode ? "Annuler les modifications ?" : "Quitter la demande ?"}
        message={
          isEditMode
            ? "Les modifications non enregistrées seront perdues."
            : "Les informations saisies seront perdues. Cette action est irréversible."
        }
        confirmLabel={isEditMode ? "Annuler les modifications" : "Quitter"}
        cancelLabel={isEditMode ? "Continuer la modification" : "Continuer la demande"}
        variant="danger"
        onConfirm={() => {
          setQuitConfirmOpen(false);
          if (isEditMode && editRequestId) {
            router.push(`/client/requests/${editRequestId}`);
          } else {
            router.push("/client/dashboard");
          }
        }}
        onClose={() => setQuitConfirmOpen(false)}
      />

      {/* Sticky bottom nav */}
      <div
        className="fixed bottom-0 right-0 flex items-center justify-center gap-8 py-5"
        style={{
          left: 241, // sidebar width
          backgroundColor: "#ffffff",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        {step > 1 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-sm font-bold text-[#6B7280] hover:text-[#1A3A52] transition-colors"
            style={mFont}
          >
            Précédent
          </button>
        )}
        {step < 7 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className="px-8 py-2.5 rounded-full text-sm font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            Suivant
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-2.5 rounded-full text-sm font-bold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#1A3A52", ...mFont }}
            >
              {submitting
                ? (isEditMode ? "Enregistrement..." : "Envoi en cours...")
                : (isEditMode ? "Enregistrer les modifications" : "Envoyer ma demande")}
            </button>
            {submitError && (
              <p className="text-xs text-[#DC2626]" style={mFont}>
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
