"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, Users, ChevronRight, Building2, LayoutGrid, Clock } from "lucide-react";
import StructureTypeBadge from "@/components/ui/StructureTypeBadge";
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

// Groupes de structures inclusives proposés au filtre.
//   - STPA (Secteur du Travail Protégé et Adapté) : ESAT + EA
//   - SIAE (Structure d'Insertion par l'Activité Économique) : EI + ACI
// L'utilisateur filtre par groupe lisible, le matcher applique l'OR
// sur les types individuels couverts par le groupe.
const STRUCTURE_GROUP_FILTERS: {
  key: "STPA" | "SIAE";
  label: string;
  types: readonly ("ESAT" | "EA" | "EI" | "ACI")[];
}[] = [
  {
    key: "STPA",
    label: "Handicap (ESAT, EA)",
    types: ["ESAT", "EA"] as const,
  },
  {
    key: "SIAE",
    label: "Insertion professionnelle (EI, ACI)",
    types: ["EI", "ACI"] as const,
  },
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

// ── Search input field ────────────────────────────────────────

function SearchField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p
        className="text-[10px] font-bold uppercase text-[#9CA3AF]"
        style={{ letterSpacing: "0.08em", ...mFont }}
      >
        {label}
      </p>
      <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus-within:border-[#1A3A52] hover:border-[#D1D5DB] focus-within:hover:border-[#1A3A52] transition-colors">
        <Icon size={15} className="shrink-0 text-[#9CA3AF]" />
        {children}
      </div>
    </div>
  );
}

// ── Filter checkbox row ───────────────────────────────────────

function FilterRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full px-2 py-1.5 -mx-2 rounded-md hover:bg-[#F5F1E8] cursor-pointer transition-colors"
    >
      <div
        className="shrink-0 w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center transition-colors"
        style={{
          borderColor: checked ? "#1A3A52" : "#D1D5DB",
          backgroundColor: checked ? "#1A3A52" : "transparent",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm text-black" style={mFont}>{label}</span>
    </button>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-[10px] font-bold uppercase text-[#9CA3AF]"
        style={{ letterSpacing: "0.08em", ...mFont }}
      >
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  initialCaterers: Caterer[];
}

export default function CatererSearch({ initialCaterers }: Props) {
  // Search bar state
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");

  // Filter state
  const [serviceTypeFilters, setServiceTypeFilters] = useState<string[]>([]);
  const [budgetFilters, setBudgetFilters] = useState<string[]>([]);
  const [dietaryFilters, setDietaryFilters] = useState<string[]>([]);
  const [structureFilters, setStructureFilters] = useState<string[]>([]);

  function toggleServiceType(key: string) {
    setServiceTypeFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }
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
  function toggleStructure(key: string) {
    setStructureFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }
  function resetFilters() {
    setServiceTypeFilters([]);
    setBudgetFilters([]);
    setDietaryFilters([]);
    setStructureFilters([]);
  }

  const totalActiveFilters =
    serviceTypeFilters.length +
    budgetFilters.length +
    dietaryFilters.length +
    structureFilters.length;

  // Filtered results
  const filtered = useMemo(() => {
    return initialCaterers.filter((c) => {
      // Types de prestation (OR : le client qui coche 2 types veut
      // voir les traiteurs qui proposent l'un OU l'autre).
      if (serviceTypeFilters.length) {
        const config = (c.service_config ?? {}) as Record<string, ServiceTypeConfig>;
        const matches = serviceTypeFilters.some((key) => config[key]?.enabled);
        if (!matches) return false;
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
      // Régimes (AND : toutes les contraintes cochées doivent être
      // couvertes — c'est plus strict mais correspond au besoin réel
      // du client : "je veux du végé ET halal" = les deux).
      if (dietaryFilters.length) {
        for (const key of dietaryFilters) {
          if (!c[key as keyof Caterer]) return false;
        }
      }
      // Type de structure : OR entre les groupes sélectionnés (un
      // traiteur dans n'importe quel type couvert par les groupes
      // cochés est retenu). Les groupes regroupent plusieurs types
      // individuels — ex. "Handicap" = ESAT ∪ EA.
      if (structureFilters.length) {
        if (!c.structure_type) return false;
        const allowedTypes = STRUCTURE_GROUP_FILTERS
          .filter((g) => structureFilters.includes(g.key))
          .flatMap((g) => g.types as readonly string[]);
        if (!allowedTypes.includes(c.structure_type)) return false;
      }
      return true;
    });
  }, [initialCaterers, serviceTypeFilters, location, budgetFilters, dietaryFilters, structureFilters]);

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
          <div className="bg-white rounded-lg p-5 flex flex-col gap-5">

            {/* Inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SearchField label="Localisation" icon={MapPin}>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ville, code postal…"
                  className="flex-1 text-sm outline-none bg-transparent text-black placeholder-[#9CA3AF] min-w-0"
                  style={mFont}
                />
              </SearchField>
              <SearchField label="Nombre de personnes" icon={Users}>
                <input
                  type="number"
                  min={1}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="Ex : 50"
                  className="flex-1 text-sm outline-none bg-transparent text-black placeholder-[#9CA3AF] min-w-0"
                  style={mFont}
                />
              </SearchField>
            </div>

          </div>

          {/* Body: filters + results */}
          <div className="flex gap-6 items-start">

            {/* ── Sidebar gauche : filtres + compare ── */}
            <div className="sticky top-4 flex flex-col gap-4 shrink-0 self-start" style={{ width: 260 }}>

              {/* ── Bloc "Comparer 3 devis" (au-dessus des filtres) ── */}
              <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#C4714A" }}
                  >
                    <LayoutGrid size={15} className="text-white" />
                  </div>
                  <p
                    className="font-display font-bold text-base text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    Comparer 3 devis
                  </p>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed" style={mFont}>
                  Remplissez une seule demande et recevez les devis des 3 premiers
                  traiteurs qui correspondent à vos critères.
                </p>
                <Link
                  href="/client/requests/new?mode=compare"
                  className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ ...mFont, backgroundColor: "#C4714A" }}
                >
                  Lancer la demande
                </Link>
              </div>

              {/* ── Filtres ── */}
              <aside className="bg-white rounded-lg p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-lg text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Filtres
                </p>
                {totalActiveFilters > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#F5F1E8", color: "#1A3A52", ...mFont }}
                  >
                    {totalActiveFilters} actif{totalActiveFilters > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <FilterSection label="Type de prestation">
                {SERVICE_TYPES.map((s) => (
                  <FilterRow
                    key={s.key}
                    label={s.label}
                    checked={serviceTypeFilters.includes(s.key)}
                    onToggle={() => toggleServiceType(s.key)}
                  />
                ))}
              </FilterSection>

              <div className="border-t border-[#F3F4F6]" />

              <FilterSection label="Type de structure">
                {STRUCTURE_GROUP_FILTERS.map((f) => (
                  <FilterRow
                    key={f.key}
                    label={f.label}
                    checked={structureFilters.includes(f.key)}
                    onToggle={() => toggleStructure(f.key)}
                  />
                ))}
              </FilterSection>

              <div className="border-t border-[#F3F4F6]" />

              <FilterSection label="Budget / personne">
                {BUDGET_FILTERS.map((f) => (
                  <FilterRow
                    key={f.key}
                    label={f.label}
                    checked={budgetFilters.includes(f.key)}
                    onToggle={() => toggleBudget(f.key)}
                  />
                ))}
              </FilterSection>

              <div className="border-t border-[#F3F4F6]" />

              <FilterSection label="Régimes alimentaires">
                {DIETARY_FILTERS.map((f) => (
                  <FilterRow
                    key={f.key}
                    label={f.label}
                    checked={dietaryFilters.includes(f.key)}
                    onToggle={() => toggleDietary(f.key)}
                  />
                ))}
              </FilterSection>

              {totalActiveFilters > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-full text-xs font-bold text-[#DC2626] border border-[#DC2626]/30 hover:bg-[#FFF5F5] transition-colors"
                  style={mFont}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Réinitialiser
                </button>
              )}
              </aside>
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
  const logo  = caterer.logo_url ?? null;

  // Régimes alimentaires couverts par le traiteur — affichés en chips
  // cream à la suite des prestations, même design.
  const activeDiets = DIETARY_FILTERS.filter((d) => caterer[d.key]);

  // Délai minimum de commande : plus grande valeur lead_time_days parmi
  // les prestations activées. Représente la contrainte la plus stricte
  // — si le client n'est pas dans ce délai, aucune prestation n'est
  // possible.
  const config = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;
  const leadTimes = Object.values(config)
    .filter((c) => c.enabled && c.lead_time_days != null && c.lead_time_days > 0)
    .map((c) => c.lead_time_days as number);
  const maxLeadTime = leadTimes.length ? Math.max(...leadTimes) : null;

  // Pills unifiés : prestations + régimes. On limite à 6 pour garder
  // la carte compacte ; le "+N" couvre le reste.
  const allPills: { key: string; label: string }[] = [
    ...services.map((s) => ({ key: s.key, label: s.label })),
    ...activeDiets.map((d) => ({ key: `diet-${d.key}`, label: d.label })),
  ];
  const PILLS_LIMIT = 6;
  const visiblePills = allPills.slice(0, PILLS_LIMIT);
  const hiddenPills  = allPills.length - visiblePills.length;

  const locationStr = caterer.city
    ? `${caterer.city}${caterer.zip_code ? ` (${caterer.zip_code.slice(0, 2)})` : ""}`
    : null;

  return (
    <Link
      href={`/client/caterers/${caterer.id}`}
      className="bg-white rounded-lg border border-[#F3F4F6] flex items-stretch overflow-hidden hover:border-[#1A3A52] hover:shadow-md transition-all group"
    >
      {/* ── Photo hero ──────────────────────────
          Image en absolute inset-0 pour que sa hauteur intrinsèque
          (surtout pour un placeholder portrait) n'influence pas la
          hauteur du card — c'est la colonne de droite qui pilote.
          Le badge type de structure flotte en haut à gauche au-dessus
          de l'image (z-10). */}
      <div className="relative shrink-0 w-[200px] bg-[#F5F1E8] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo ?? "/images/caterer-photo-placeholder.png"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
        />
        {caterer.structure_type && (
          <div className="absolute top-2 left-2 z-10">
            <StructureTypeBadge type={caterer.structure_type} />
          </div>
        )}
      </div>

      {/* ── Contenu ───────────────────────────── */}
      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">

        {/* Ligne 1 : logo + nom + ville */}
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#F5F1E8] flex items-center justify-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 size={16} style={{ color: "#C4714A" }} />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <p
              className="font-display font-bold text-lg text-black truncate leading-tight"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              {caterer.name}
            </p>
            {locationStr && (
              <div className="flex items-center gap-1 text-xs text-[#6B7280] mt-0.5" style={mFont}>
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">
                  {locationStr}
                  {caterer.delivery_radius_km ? ` · Livre jusqu'à ${caterer.delivery_radius_km} km` : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Ligne 2 : description (1 ligne, tronquée) */}
        {caterer.description && (
          <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-1" style={mFont}>
            {caterer.description}
          </p>
        )}

        {/* Ligne 3 : prestations + régimes alimentaires (mêmes chips) */}
        {allPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visiblePills.map(({ key, label }) => (
              <span
                key={key}
                className="px-2 py-0.5 rounded-full text-xs font-bold text-[#1A3A52]"
                style={{ ...mFont, backgroundColor: "#F5F1E8" }}
              >
                {label}
              </span>
            ))}
            {hiddenPills > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold text-[#9CA3AF]"
                style={{ ...mFont, backgroundColor: "#F5F1E8" }}
              >
                +{hiddenPills}
              </span>
            )}
          </div>
        )}

        {/* Footer : délai minimum + CTA */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-[#F3F4F6]">
          {maxLeadTime != null ? (
            <p className="text-xs text-[#6B7280] flex items-center gap-1.5" style={mFont}>
              <Clock size={13} className="shrink-0 text-[#1A3A52]" />
              À commander{" "}
              <span className="text-sm font-bold text-black">
                {maxLeadTime} jour{maxLeadTime > 1 ? "s" : ""}
              </span>{" "}
              à l&apos;avance
            </p>
          ) : (
            <p className="text-xs text-[#9CA3AF] italic" style={mFont}>
              Délai sur demande
            </p>
          )}
          <span
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3A52] group-hover:gap-2 transition-all"
            style={mFont}
          >
            Voir la fiche
            <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}
