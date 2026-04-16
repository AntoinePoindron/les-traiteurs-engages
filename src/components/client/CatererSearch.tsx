"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, Calendar, Users, ChevronRight, Search } from "lucide-react";
import type { Caterer, ServiceTypeConfig } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: "petit_dejeuner",        label: "Petit déjeuner" },
  { key: "pause_gourmande",       label: "Pause gourmande" },
  { key: "plateaux_repas",        label: "Plateaux repas" },
  { key: "cocktail_dinatoire",    label: "Cocktail dinatoire" },
  { key: "cocktail_dejeunatoire", label: "Cocktail déjeunatoire" },
  { key: "cocktail_aperitif",     label: "Apéritif" },
] as const;

const BUDGET_FILTERS = [
  { key: "lt15",    label: "Moins de 15 €",  max: 15 },
  { key: "15to30",  label: "15 € – 30 €",    min: 15,  max: 30 },
  { key: "30to50",  label: "30 € – 50 €",    min: 30,  max: 50 },
  { key: "gt50",    label: "Plus de 50 €",   min: 50 },
] as const;

const DIETARY_FILTERS = [
  { key: "dietary_vegetarian" as const, label: "Végétarien" },
  { key: "dietary_gluten_free" as const, label: "Sans gluten" },
  { key: "dietary_halal" as const, label: "Halal" },
  { key: "dietary_bio" as const, label: "Bio" },
];

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// ── Helpers ───────────────────────────────────────────────────

function getEnabledServices(caterer: Caterer): { key: string; label: string; priceMin: number | null }[] {
  const config = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;
  return SERVICE_TYPES
    .filter(({ key }) => config[key]?.enabled)
    .map(({ key, label }) => ({
      key,
      label,
      priceMin: config[key]?.price_per_person_min ?? null,
    }));
}

function catererMatchesBudget(caterer: Caterer, budgetKeys: string[]): boolean {
  if (!budgetKeys.length) return true;
  const config = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;
  const prices = Object.values(config)
    .filter((c) => c.enabled && c.price_per_person_min != null)
    .map((c) => c.price_per_person_min as number);
  if (!prices.length) return true;
  const minPrice = Math.min(...prices);
  return budgetKeys.some((k) => {
    const f = BUDGET_FILTERS.find((b) => b.key === k);
    if (!f) return false;
    const above = "min" in f ? minPrice >= f.min : true;
    const below = "max" in f ? minPrice <= f.max : true;
    return above && below;
  });
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(score) ? "#FBBF24" : "#E5E7EB"}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      ))}
    </div>
  );
}

// ── Filter checkbox row ───────────────────────────────────────

function FilterRow({
  label,
  checked,
  onToggle,
  count,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <div
          className="shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors"
          style={{
            borderColor: checked ? "#1A3A52" : "#1A1A1A",
            backgroundColor: checked ? "#1A3A52" : "transparent",
          }}
        >
          {checked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-xs text-black" style={mFont}>{label}</span>
      </div>
      {count !== undefined && (
        <span className="text-xs text-[#A6A6A6]" style={mFont}>{count}</span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  initialCaterers: Caterer[];
}

export default function CatererSearch({ initialCaterers }: Props) {
  // Search bar state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [guestCount, setGuestCount] = useState("");

  // Filter state
  const [budgetFilters, setBudgetFilters] = useState<string[]>([]);
  const [dietaryFilters, setDietaryFilters] = useState<string[]>([]);

  function toggleBudget(key: string) {
    setBudgetFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }
  function toggleDietary(key: string) {
    setDietaryFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }
  function resetFilters() {
    setBudgetFilters([]);
    setDietaryFilters([]);
  }

  // Filtered results
  const filtered = useMemo(() => {
    return initialCaterers.filter((c) => {
      // Type de prestation
      if (selectedType) {
        const config = (c.service_config ?? {}) as Record<string, ServiceTypeConfig>;
        if (!config[selectedType]?.enabled) return false;
      }
      // Localisation (simple text match on city/zip)
      if (location.trim()) {
        const q = location.trim().toLowerCase();
        if (
          !c.city?.toLowerCase().includes(q) &&
          !c.zip_code?.toLowerCase().includes(q)
        ) return false;
      }
      // Budget
      if (!catererMatchesBudget(c, budgetFilters)) return false;
      // Régimes
      if (dietaryFilters.length) {
        for (const key of dietaryFilters) {
          if (!c[key as keyof Caterer]) return false;
        }
      }
      return true;
    });
  }, [initialCaterers, selectedType, location, budgetFilters, dietaryFilters]);

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: 1020 }}>

          {/* Title */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Trouvez votre traiteur inclusif
          </h1>

          {/* Search block */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-6 overflow-hidden relative">

            {/* Type de prestation */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-black" style={mFont}>Type de prestation</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map(({ key, label }) => {
                  const active = selectedType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedType(active ? null : key)}
                      className="px-3 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer"
                      style={{
                        ...mFont,
                        backgroundColor: active ? "#1A3A52" : "#F5F1E8",
                        color: active ? "#FFFFFF" : "#1A3A52",
                        border: active ? "1px solid #1A3A52" : "1px solid transparent",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inputs row */}
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-black" style={mFont}>Localisation</p>
                <div className="flex items-center gap-2 border border-black rounded-lg px-3 py-2.5 bg-white w-[220px]">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ville, code postal..."
                    className="flex-1 text-xs outline-none bg-transparent text-black placeholder-[#BFBFBF]"
                    style={mFont}
                  />
                  <MapPin size={16} className="shrink-0 text-[#9CA3AF]" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-black" style={mFont}>Date de l&apos;événement</p>
                <div className="flex items-center gap-2 border border-black rounded-lg px-3 py-2.5 bg-white w-[220px]">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 text-xs outline-none bg-transparent text-black"
                    style={mFont}
                  />
                  <Calendar size={16} className="shrink-0 text-[#9CA3AF]" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-black" style={mFont}>Nombre de personnes</p>
                <div className="flex items-center gap-2 border border-black rounded-lg px-3 py-2.5 bg-white w-[220px]">
                  <input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="Ex : 50"
                    className="flex-1 text-xs outline-none bg-transparent text-black placeholder-[#BFBFBF]"
                    style={mFont}
                  />
                  <Users size={16} className="shrink-0 text-[#9CA3AF]" />
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                style={{ ...mFont, backgroundColor: "#1A3A52" }}
              >
                <Search size={14} />
                Rechercher
              </button>
              <Link
                href="/client/requests/new?mode=compare"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                style={{ ...mFont, backgroundColor: "#C4714A" }}
              >
                Comparer 3 devis
              </Link>
            </div>
          </div>

          {/* Body: filters + results */}
          <div className="flex gap-6 items-start">

            {/* ── Filtres ── */}
            <div className="bg-white rounded-lg p-6 flex flex-col gap-5 shrink-0" style={{ width: 260 }}>
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Filtres
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-[#1A3A52] underline cursor-pointer"
                  style={mFont}
                >
                  Réinitialiser
                </button>
              </div>

              {/* Budget */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-black" style={mFont}>Budget par personne</p>
                {BUDGET_FILTERS.map((f) => (
                  <FilterRow
                    key={f.key}
                    label={f.label}
                    checked={budgetFilters.includes(f.key)}
                    onToggle={() => toggleBudget(f.key)}
                  />
                ))}
              </div>

              <div className="border-t border-[#f2f2f2]" />

              {/* Régimes alimentaires */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-black" style={mFont}>Options de régime alimentaire</p>
                {DIETARY_FILTERS.map((f) => (
                  <FilterRow
                    key={f.key}
                    label={f.label}
                    checked={dietaryFilters.includes(f.key)}
                    onToggle={() => toggleDietary(f.key)}
                  />
                ))}
              </div>
            </div>

            {/* ── Résultats ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Count + sort */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-black" style={mFont}>
                  <span className="font-bold">{filtered.length} traiteur{filtered.length !== 1 ? "s" : ""} </span>
                  correspondent à votre recherche
                </p>
              </div>

              {filtered.length === 0 ? (
                <div className="bg-white rounded-lg p-12 flex flex-col items-center gap-3">
                  <p className="text-sm font-bold text-black" style={mFont}>Aucun résultat</p>
                  <p className="text-xs text-[#6B7280] text-center" style={mFont}>
                    Essayez de modifier vos filtres ou votre localisation.
                  </p>
                </div>
              ) : (
                filtered.map((caterer) => (
                  <CatererCard key={caterer.id} caterer={caterer} />
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

// ── Caterer card ──────────────────────────────────────────────

function CatererCard({ caterer }: { caterer: Caterer }) {
  const services = getEnabledServices(caterer);
  const photo = caterer.photos?.[0] ?? null;
  // Placeholder rating (real ratings not in DB yet)
  const rating = 4.8;
  const reviewCount = 0;

  return (
    <Link
      href={`/client/caterers/${caterer.id}`}
      className="bg-white rounded-lg border border-[#F2F2F2] flex items-stretch hover:border-[#1A3A52] transition-colors group"
    >
      {/* Photo */}
      <div className="shrink-0 w-[150px] rounded-l-lg overflow-hidden bg-[#F5F1E8] flex items-center justify-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={caterer.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full min-h-[180px] bg-[#EDE9DF] flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-[#C4714A] opacity-30" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
              {caterer.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 px-8 py-4 flex flex-col gap-2">
        {/* Name + location */}
        <div className="flex flex-col gap-1">
          <p
            className="font-display font-bold text-xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            {caterer.name}
          </p>
          {caterer.city && (
            <p className="text-xs text-[#313131]" style={mFont}>
              {caterer.city}{caterer.zip_code ? ` (${caterer.zip_code.slice(0, 2)})` : ""}
              {caterer.delivery_radius_km ? ` · Livraison jusqu'à ${caterer.delivery_radius_km} km` : ""}
            </p>
          )}
          {reviewCount > 0 && (
            <div className="flex items-center gap-2">
              <StarRating score={rating} />
              <p className="text-xs text-black" style={mFont}>
                <span className="font-bold">{rating.toFixed(1)}/5</span>
                <span className="text-[#313131]"> ({reviewCount} avis)</span>
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {caterer.description && (
          <p className="text-xs text-[#313131] leading-[1.5] line-clamp-2" style={mFont}>
            {caterer.description}
          </p>
        )}

        {/* Service chips */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {services.slice(0, 4).map(({ key, label, priceMin }) => (
              <span
                key={key}
                className="px-2 py-1 rounded-full text-[10px] text-[#1A3A52]"
                style={{ ...mFont, backgroundColor: "#F5F1E8" }}
              >
                {label}{priceMin != null ? ` · dès ${priceMin} €/pers.` : ""}
              </span>
            ))}
            {services.length > 4 && (
              <span className="px-2 py-1 rounded-full text-[10px] text-[#9CA3AF]" style={{ ...mFont, backgroundColor: "#F5F1E8" }}>
                +{services.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chevron */}
      <div className="shrink-0 flex items-center pr-4 pl-2">
        <ChevronRight size={18} className="text-[#9CA3AF] group-hover:text-[#1A3A52] transition-colors" />
      </div>
    </Link>
  );
}
