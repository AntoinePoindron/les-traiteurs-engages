import { Clock } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function PendingQualificationBanner() {
  return (
    <div
      className="rounded-lg p-4 flex items-start gap-3 border-l-4"
      style={{ backgroundColor: "#FEF3C7", borderLeftColor: "#B45309" }}
    >
      <Clock size={18} className="shrink-0 mt-0.5" style={{ color: "#B45309" }} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold" style={{ color: "#92400E", ...mFont }}>
          En attente de qualification
        </p>
        <p className="text-xs" style={{ color: "#92400E", ...mFont }}>
          Votre fiche est en cours d&apos;examen par notre équipe. En attendant, complétez
          au maximum votre profil (logo, description, prestations, photos) — ça accélérera la
          validation et votre référencement.
        </p>
      </div>
    </div>
  );
}
