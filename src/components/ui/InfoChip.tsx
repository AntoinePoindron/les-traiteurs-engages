import { type LucideIcon } from "lucide-react";

interface InfoChipProps {
  icon: LucideIcon;
  label?: string;
  value: string;
}

/**
 * Chip d'information (budget, couverts, date, lieu) tel que dans les maquettes Figma.
 * Fond crème arrondi, icône + valeur en Marianne Bold.
 */
export default function InfoChip({ icon: Icon, label, value }: InfoChipProps) {
  return (
    <div className="flex flex-col gap-2 items-start shrink-0">
      {label && (
        <p className="text-[10px] text-[#313131]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
          {label}
        </p>
      )}
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-full"
        style={{ backgroundColor: "#F5F1E8" }}
      >
        <Icon size={16} className="shrink-0 text-[#313131]" />
        <span
          className="text-xs font-bold text-[#313131] whitespace-nowrap"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
