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
      // Récupère l'état à jour via l'API V1 (plus simple : retourne
      // directement charges_enabled / payouts_enabled sans header
      // Stripe-Context à passer manuellement).
      const account = await stripe.accounts.retrieve(accountId);

      const payoutsEnabled = !!account.payouts_enabled;
      const chargesEnabled = !!account.charges_enabled;

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

  // ── V1 event : checkout.session.completed ────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    if (!session) {
      console.warn("[stripe-webhook] checkout.session.completed sans data.object");
      return NextResponse.json({ received: true });
    }

    const sessionId = session.id as string;
    const paymentIntentId = (session.payment_intent as string | null) ?? null;
    const orderId = (session.client_reference_id as string | null)
      ?? (session.metadata?.order_id as string | null)
      ?? null;
    const paymentStatus = session.payment_status as string | undefined;

    // Stripe peut envoyer l'event même si payment_status = "unpaid" (bank
    // authorisation asynchrone). On ne marque comme succeeded que si Stripe
    // confirme "paid" ou "no_payment_required".
    const succeeded = paymentStatus === "paid" || paymentStatus === "no_payment_required";

    // Cherche la ligne payments existante créée par createOrderCheckoutSession
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from("payments")
      .select("id, order_id")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (admin as any)
        .from("payments")
        .update({
          status: succeeded ? "succeeded" : "processing",
          stripe_payment_intent_id: paymentIntentId,
          succeeded_at: succeeded ? now : null,
          last_event_at: now,
        })
        .eq("id", existing.id);
      if (updateErr) {
        console.error("[stripe-webhook] update payment failed:", updateErr);
      }
    } else if (orderId) {
      // Fallback : la ligne n'existait pas (server action a échoué après le
      // create mais avant l'insert). On crée la ligne ici pour ne rien perdre.
      console.warn("[stripe-webhook] payment row missing, inserting from webhook");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orderRow } = await (admin as any)
        .from("orders")
        .select("quotes(total_amount_ht, caterers(id, commission_rate))")
        .eq("id", orderId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = orderRow as any;
      const caterer = o?.quotes?.caterers;
      const amountTotalCents = Number(session.amount_total ?? 0);
      const rate = Number(caterer?.commission_rate ?? 10);
      const feeCents = Math.round((amountTotalCents * rate) / 100);
      if (caterer?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("payments").insert({
          order_id: orderId,
          caterer_id: caterer.id,
          stripe_checkout_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId,
          status: succeeded ? "succeeded" : "processing",
          amount_total_cents: amountTotalCents,
          application_fee_cents: feeCents,
          amount_to_caterer_cents: amountTotalCents - feeCents,
          currency: (session.currency as string) ?? "eur",
          succeeded_at: succeeded ? now : null,
          last_event_at: now,
        });
      }
    }

    // Met à jour la commande en "paid" si succeeded
    if (succeeded && orderId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: orderErr } = await (admin as any)
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId);
      if (orderErr) {
        console.error("[stripe-webhook] update order to paid failed:", orderErr);
      }
    }

    return NextResponse.json({ received: true });
  }

  // ── V1 event : payment_intent.payment_failed ──────────────────
  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data?.object;
    const intentId = intent?.id as string | undefined;
    const failureMessage = (intent?.last_payment_error?.message as string | undefined) ?? null;

    if (intentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("payments")
        .update({
          status: "failed",
          failure_reason: failureMessage,
          last_event_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", intentId);
    }

    return NextResponse.json({ received: true });
  }

  // Event non géré — on ACK quand même pour ne pas générer de retries.
  console.log("[stripe-webhook] event ignoré :", event.type);
  return NextResponse.json({ received: true });
}
