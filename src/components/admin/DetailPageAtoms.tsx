import type React from "react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

/**
 * Bloc blanc arrondi avec titre — utilisé comme conteneur principal des
 * sections sur les pages de détail admin (caterer, company…).
 */
export function Section({
  title,
  right,
  children,
}: {
  title: string;
  /** Optionnel : élément à aligner à droite du titre (lien, badge…) */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p
          className="font-display font-bold text-lg text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * Ligne "label + valeur" avec icône, pour la colonne Informations des
 * pages de détail admin.
 */
export function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[#9CA3AF] mt-0.5 shrink-0" />
      <div className="flex flex-col min-w-0">
        <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{label}</p>
        <p className="text-sm font-bold text-black break-words" style={mFont}>{value}</p>
      </div>
    </div>
  );
}

/**
 * Carte KPI (icône + chiffre + label) — grille en haut de la colonne
 * d'activité des pages de détail admin.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-lg p-4 flex flex-col gap-2">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: "#F0F4F7" }}
      >
        <Icon size={14} style={{ color: "#1A3A52" }} />
      </div>
      <div>
        <p
          className="font-display font-bold text-2xl text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          {value}
        </p>
        <p className="text-[11px] text-[#6B7280] mt-0.5" style={mFont}>{label}</p>
      </div>
    </div>
  );
}
