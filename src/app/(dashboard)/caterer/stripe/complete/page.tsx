import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Don't cache — need the freshest Stripe status.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default async function StripeOnboardingComplete() {
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
    .select("stripe_charges_enabled, stripe_payouts_enabled")
    .eq("id", catererId ?? "")
    .single();

  const caterer = catererRaw as {
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
  } | null;

  const isReady = !!(caterer?.stripe_charges_enabled && caterer?.stripe_payouts_enabled);

  return (
    <main className="flex-1 overflow-y-auto flex items-start justify-center" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[120px] px-6 pb-12 w-full">
        <div className="mx-auto flex flex-col gap-4 bg-white rounded-lg p-8 items-center text-center" style={{ maxWidth: "500px" }}>

          {isReady ? (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#DCFCE7" }}>
                <CheckCircle size={28} style={{ color: "#16A34A" }} />
              </div>
              <h1
                className="font-display font-bold text-2xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Paiements activés
              </h1>
              <p className="text-sm text-[#6B7280]" style={mFont}>
                Votre compte Stripe est configuré. Vous recevrez automatiquement les règlements
                des commandes payées par vos clients.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FFF3CD" }}>
                <Clock size={28} style={{ color: "#B45309" }} />
              </div>
              <h1
                className="font-display font-bold text-2xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Configuration en cours
              </h1>
              <p className="text-sm text-[#6B7280]" style={mFont}>
                Votre dossier est en cours de vérification par Stripe. Vous recevrez une
                notification dès qu&apos;il sera validé (généralement sous quelques minutes).
              </p>
            </>
          )}

          <Link
            href="/caterer/stripe"
            className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            Voir le statut
          </Link>
        </div>
      </div>
    </main>
  );
}
