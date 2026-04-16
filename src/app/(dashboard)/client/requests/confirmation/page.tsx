import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";

type SearchParams = Promise<{ mode?: string; caterer?: string }>;

export default async function RequestConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { mode, caterer } = await searchParams;
  const isCompare = mode === "compare";

  const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

  return (
    <div
      className="flex-1 flex items-center justify-center p-8"
      style={{ backgroundColor: "#F5F1E8" }}
    >
      <div className="bg-white rounded-2xl p-10 flex flex-col items-center text-center max-w-md w-full gap-6">
        {/* Icône */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#DCFCE7" }}
        >
          <CheckCircle size={32} style={{ color: "#16A34A" }} />
        </div>

        {/* Titre */}
        <div className="flex flex-col gap-2">
          <h1
            className="font-display font-bold text-2xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Demande envoyée !
          </h1>
          <p className="text-sm text-[#6B7280]" style={mFont}>
            {isCompare
              ? "Votre demande a été transmise aux 3 traiteurs les plus pertinents pour votre événement."
              : caterer
              ? `Votre demande a bien été envoyée à ${caterer}.`
              : "Votre demande a bien été envoyée."}
          </p>
        </div>

        {/* Délai */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl w-full"
          style={{ backgroundColor: "#F5F1E8" }}
        >
          <Clock size={18} style={{ color: "#6B7280", flexShrink: 0 }} />
          <p className="text-sm text-[#6B7280] text-left" style={mFont}>
            {isCompare
              ? "Les traiteurs ont généralement 48 h pour vous répondre. Vous serez notifié dès qu'un devis est disponible."
              : "Le traiteur a généralement 48 h pour vous répondre. Vous serez notifié dès que le devis est disponible."}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/client/requests"
            className="w-full flex items-center justify-center px-6 py-3 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            Voir mes demandes
          </Link>
          <Link
            href="/client/dashboard"
            className="w-full flex items-center justify-center px-6 py-3 rounded-full text-sm font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
            style={mFont}
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
