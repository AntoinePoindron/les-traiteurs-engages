import type { CatererStructureType } from "@/types/database";

/**
 * Badge indiquant le type de structure d'un traiteur (ESAT, EA, …).
 *
 * Style vert "label inclusif" — même codes visuels que les autres
 * badges de mise en avant positive sur la plateforme. Les régimes
 * alimentaires utilisent désormais des chips cream/navy, donc il n'y
 * a plus de conflit visuel avec eux.
 */
interface StructureTypeBadgeProps {
  type: CatererStructureType;
  size?: "sm" | "md";
}

const STRUCTURE_TYPE_LABELS: Record<CatererStructureType, string> = {
  ESAT: "ESAT",
  EA:   "Entreprise Adaptée",
  EI:   "Entreprise d'Insertion",
  ACI:  "Atelier et Chantier d'Insertion",
};

export default function StructureTypeBadge({ type, size = "sm" }: StructureTypeBadgeProps) {
  const label = STRUCTURE_TYPE_LABELS[type];

  const cls =
    size === "md"
      ? "inline-flex w-fit items-center px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
      : "inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap";

  return (
    <span
      className={cls}
      style={{
        backgroundColor: "#DCFCE7",
        color: "#16A34A",
        fontFamily: "Marianne, system-ui, sans-serif",
      }}
    >
      {label}
    </span>
  );
}
