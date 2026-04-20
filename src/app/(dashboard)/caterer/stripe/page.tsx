import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import { CheckCircle, Clock, CreditCard, ExternalLink, Info } from "lucide-react";
import StartOnboardingButton from "./StartOnboardingButton";

// Never cache — status comes from webhooks and must reflect the latest state.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type CatererStripe = {
  id: string;
  name: string;
  stripe_account_id: string | null;
  stripe_onboarded_at: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function CatererStripePage({ searchParams }: PageProps) {
  const { status: urlStatus } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("users")
    .select("caterer_id")
    .eq("id", user!.id)
    .single();

  const catererId = (profile as { caterer_id: string | null } | null)?.caterer_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererRaw } = await (supabase as any)
    .from("caterers")
    .select("id, name, stripe_account_id, stripe_onboarded_at, stripe_charges_enabled, stripe_payouts_enabled")
    .eq("id", catererId ?? "")
    .single();

  const caterer = catererRaw as CatererStripe | null;

  const hasAccount = !!caterer?.stripe_account_id;
  const isReady = !!(caterer?.stripe_charges_enabled && caterer?.stripe_payouts_enabled);
  const isPartial = hasAccount && !isReady;

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "720px" }}>

          <BackButton label="Retour" />

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#E5EDF2" }}>
              <CreditCard size={22} style={{ color: "#1A3A52" }} />
            </div>
            <div>
              <h1
                className="font-display font-bold text-3xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Paiements Stripe
              </h1>
              <p className="text-sm text-[#6B7280]" style={mFont}>
                Activez les paiements pour recevoir automatiquement les règlements de vos commandes.
              </p>
            </div>
          </div>

          {urlStatus === "refresh" && (
            <div
              className="bg-white rounded-lg p-4 border-l-4 flex items-start gap-3"
              style={{ borderLeftColor: "#F59E0B" }}
            >
              <Info size={18} style={{ color: "#B45309" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-black" style={mFont}>Onboarding interrompu</p>
                <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>
                  Votre session Stripe a expiré. Relancez l&apos;onboarding pour continuer.
                </p>
              </div>
            </div>
          )}

          {/* Statut actuel */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
            <p
              className="font-display font-bold text-lg text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Statut du compte
            </p>

            {!hasAccount && (
              <>
                <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: "#F0F4F7" }}>
                  <CreditCard size={18} style={{ color: "#1A3A52" }} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-black" style={mFont}>
                      Paiements non configurés
                    </p>
                    <p className="text-xs text-[#6B7280]" style={mFont}>
                      Cliquez sur le bouton ci-dessous pour créer votre compte Stripe et renseigner
                      vos coordonnées bancaires. Le processus prend environ 5 minutes.
                    </p>
                  </div>
                </div>
                <StartOnboardingButton label="Activer les paiements" />
              </>
            )}

            {isPartial && (
              <>
                <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: "#FFF3CD" }}>
                  <Clock size={18} style={{ color: "#B45309" }} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-black" style={mFont}>
                      Onboarding incomplet
                    </p>
                    <p className="text-xs text-[#6B7280]" style={mFont}>
                      Votre compte Stripe est créé mais il manque des informations. Continuez
                      l&apos;onboarding pour activer la réception des paiements.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F4F6]">
                  <StatusRow label="Paiements acceptés" ok={caterer?.stripe_charges_enabled ?? false} />
                  <StatusRow label="Virements bancaires" ok={caterer?.stripe_payouts_enabled ?? false} />
                </div>
                <StartOnboardingButton label="Continuer l'onboarding" />
              </>
            )}

            {isReady && (
              <>
                <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: "#DCFCE7" }}>
                  <CheckCircle size={18} style={{ color: "#16A34A" }} className="shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-black" style={mFont}>
                      Paiements actifs
                    </p>
                    <p className="text-xs text-[#6B7280]" style={mFont}>
                      Votre compte est prêt à recevoir les règlements de vos commandes.
                      Les virements vers votre compte bancaire sont automatiques.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F4F6]">
                  <StatusRow label="Paiements acceptés" ok={caterer?.stripe_charges_enabled ?? false} />
                  <StatusRow label="Virements bancaires" ok={caterer?.stripe_payouts_enabled ?? false} />
                </div>
                <a
                  href="https://dashboard.stripe.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F0F4F8] transition-colors self-start"
                  style={mFont}
                >
                  <ExternalLink size={13} />
                  Accéder à mon dashboard Stripe
                </a>
              </>
            )}
          </div>

          {/* Infos légales */}
          <div className="text-xs text-[#9CA3AF] leading-relaxed" style={mFont}>
            <p>
              Stripe est notre prestataire de paiement. Il collecte vos informations bancaires
              et d&apos;identité (SIRET, RIB, pièce d&apos;identité) pour vérifier votre structure
              conformément à la réglementation européenne (KYC). Ces données ne transitent pas
              par notre plateforme.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#6B7280]" style={mFont}>{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#16A34A", ...mFont }}>
          <CheckCircle size={12} />
          Actif
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#B45309", ...mFont }}>
          <Clock size={12} />
          En attente
        </span>
      )}
    </div>
  );
}
