import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import { CheckCircle, Clock, CreditCard, ExternalLink, Info } from "lucide-react";
import StartOnboardingButton from "./StartOnboardingButton";
import RefreshStatusButton from "./RefreshStatusButton";

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

  // ── Historique des paiements ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentsRaw } = await (supabase as any)
    .from("payments")
    .select(`
      id, status, amount_total_cents, application_fee_cents, amount_to_caterer_cents,
      currency, succeeded_at, created_at,
      orders (
        id,
        quotes (
          quote_requests (
            title,
            companies ( name )
          )
        )
      )
    `)
    .eq("caterer_id", catererId ?? "")
    .order("created_at", { ascending: false })
    .limit(20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments = (paymentsRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const succeededPayments = payments.filter((p: any) => p.status === "succeeded");

  const totalReceivedCents = succeededPayments.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, p: any) => sum + Number(p.amount_to_caterer_cents ?? 0),
    0,
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthReceivedCents = succeededPayments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.succeeded_at && new Date(p.succeeded_at) >= startOfMonth)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((sum: number, p: any) => sum + Number(p.amount_to_caterer_cents ?? 0), 0);

  function formatEuroFromCents(cents: number): string {
    return (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  function formatPaymentDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

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
                      Votre compte Stripe est créé mais il manque des informations ou la
                      validation est encore en cours côté Stripe. Cliquez sur &quot;Vérifier
                      le statut&quot; si vous venez de finaliser votre inscription, ou relancez
                      l&apos;onboarding pour compléter les infos manquantes.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-[#F3F4F6]">
                  <StatusRow label="Paiements acceptés" ok={caterer?.stripe_charges_enabled ?? false} />
                  <StatusRow label="Virements bancaires" ok={caterer?.stripe_payouts_enabled ?? false} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <RefreshStatusButton />
                  <StartOnboardingButton label="Continuer l'onboarding" />
                </div>
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

          {/* Historique des paiements — visible uniquement si compte actif */}
          {isReady && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-4 flex flex-col gap-1">
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wide" style={mFont}>
                    Reçu ce mois
                  </p>
                  <p
                    className="font-display font-bold text-2xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {monthReceivedCents > 0 ? `${formatEuroFromCents(monthReceivedCents)} €` : "—"}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 flex flex-col gap-1">
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-wide" style={mFont}>
                    Total reçu
                  </p>
                  <p
                    className="font-display font-bold text-2xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {totalReceivedCents > 0 ? `${formatEuroFromCents(totalReceivedCents)} €` : "—"}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]" style={mFont}>
                    Sur {succeededPayments.length} commande{succeededPayments.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Liste des paiements */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p
                  className="font-display font-bold text-lg text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Historique des paiements
                </p>
                {payments.length === 0 ? (
                  <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                    Aucun paiement pour l&apos;instant. Les règlements apparaîtront ici dès
                    qu&apos;une commande sera réglée.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {payments.map((p) => {
                      const qr = p.orders?.quotes?.quote_requests;
                      const title = qr?.title ?? "Commande";
                      const companyName = qr?.companies?.name ?? "—";
                      const net = Number(p.amount_to_caterer_cents ?? 0);
                      const total = Number(p.amount_total_cents ?? 0);
                      const fee = Number(p.application_fee_cents ?? 0);
                      const isSucceeded = p.status === "succeeded";
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex flex-col min-w-0 gap-0.5">
                            <p className="text-sm font-bold text-black truncate" style={mFont}>
                              {title}
                            </p>
                            <p className="text-xs text-[#9CA3AF]" style={mFont}>
                              {companyName} · {formatPaymentDate(p.succeeded_at ?? p.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <p className="text-sm font-bold" style={{
                              color: isSucceeded ? "#16A34A" : "#9CA3AF",
                              ...mFont,
                            }}>
                              {isSucceeded ? `+${formatEuroFromCents(net)} €` : "—"}
                            </p>
                            <p className="text-[11px] text-[#9CA3AF]" style={mFont}>
                              {isSucceeded
                                ? `sur ${formatEuroFromCents(total)} € (commission ${formatEuroFromCents(fee)} €)`
                                : statusLabel(p.status)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {payments.length >= 20 && (
                  <p className="text-[11px] text-[#9CA3AF] text-center pt-2" style={mFont}>
                    20 dernières transactions affichées. Consultez votre dashboard Stripe pour
                    l&apos;historique complet.
                  </p>
                )}
              </div>
            </>
          )}

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

function statusLabel(status: string): string {
  switch (status) {
    case "succeeded":  return "Paiement reçu";
    case "pending":    return "En attente";
    case "processing": return "En cours";
    case "failed":     return "Échec";
    case "canceled":   return "Annulé";
    case "refunded":   return "Remboursé";
    default:           return status;
  }
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
