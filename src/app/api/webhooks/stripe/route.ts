import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Make sure Next doesn't consume the body before we can verify the signature.
export const dynamic = "force-dynamic";

/**
 * Unique endpoint webhook Stripe.
 *
 * En phase 2, on gère l'event V2 (thin event) qui signale le changement de
 * statut des capabilities d'un compte connecté — c'est ainsi qu'on sait que
 * le traiteur a terminé son onboarding KYC.
 *
 * En phase 3, on ajoutera `checkout.session.completed` (V1 snapshot) pour
 * marquer une commande comme payée.
 *
 * Setup côté Stripe Dashboard :
 *  - Developers → Webhooks → Add endpoint
 *  - URL publique : https://<votre-domaine>/api/webhooks/stripe
 *  - Events à écouter (V2 et V1 mélangés) :
 *      • v2.core.account[configuration.recipient].capability_status_updated
 *      • checkout.session.completed  (phase 3)
 *      • payment_intent.payment_failed  (phase 3)
 *  - Copier le signing secret (whsec_…) dans STRIPE_WEBHOOK_SECRET.
 *
 * En local, utiliser la CLI Stripe :
 *    stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.error("[stripe-webhook] signature ou secret manquant");
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 400 });
  }

  const stripe = getStripeClient();

  // IMPORTANT : Stripe exige le body brut pour vérifier la signature.
  const rawBody = await request.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature invalide :", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── V2 thin event : capability updated ───────────────────────
  // Format : "v2.core.account[configuration.recipient].capability_status_updated"
  if (typeof event.type === "string" && event.type.startsWith("v2.core.account")) {
    const accountId: string | undefined = event.related_object?.id ?? event.data?.object?.id;

    if (!accountId) {
      console.warn("[stripe-webhook] v2 account event sans related_object.id", event.id);
      return NextResponse.json({ received: true });
    }

    try {
      // Récupère l'état à jour du compte (l'event V2 est "thin" = on re-fetch)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (stripe as any).v2.core.accounts.retrieve(accountId, {
        include: ["configuration.recipient", "identity"],
      });

      const recipient = account.configuration?.recipient;
      const transfersStatus =
        recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;

      // "active" = capability OK et fonds transférables
      const payoutsEnabled = transfersStatus === "active";
      // Pour l'onboarding recipient-only, on considère charges_enabled = payouts_enabled.
      // Quand on ajoutera des charges directes (phase 3), on regardera aussi merchant.
      const chargesEnabled = payoutsEnabled;

      const onboardedAt = payoutsEnabled ? new Date().toISOString() : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (admin as any)
        .from("caterers")
        .update({
          stripe_charges_enabled: chargesEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          stripe_onboarded_at: onboardedAt,
        })
        .eq("stripe_account_id", accountId);

      if (updateErr) {
        console.error("[stripe-webhook] update caterers échoué :", updateErr);
        // On répond quand même 200 pour que Stripe ne retry pas à l'infini si
        // c'est une erreur métier. Les erreurs réseau passagères, elles,
        // remonteront via un throw dans le constructEvent.
      }

      return NextResponse.json({ received: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[stripe-webhook] traitement v2 account échoué :", msg);
      return NextResponse.json({ received: true, error: msg });
    }
  }

  // TODO phase 3 : checkout.session.completed, payment_intent.payment_failed

  // Event non géré — on ACK quand même pour ne pas générer de retries.
  console.log("[stripe-webhook] event ignoré :", event.type);
  return NextResponse.json({ received: true });
}
