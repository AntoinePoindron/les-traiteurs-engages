"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/server";
import {
  STRIPE_CURRENCY,
  computeApplicationFeeCents,
  euroToCents,
} from "@/lib/stripe/constants";

/**
 * Crée une Checkout Session Stripe pour le paiement d'une commande.
 *
 * Sémantique "Destination charges" du blueprint Accounts V2 marketplace :
 *   - La plateforme est le merchant (émet le reçu au client)
 *   - `application_fee_amount` = commission plateforme (en centimes)
 *   - `transfer_data.destination` = compte connecté Stripe du traiteur
 *   - Stripe reverse automatiquement le reste au traiteur
 *
 * Conditions pour que le paiement soit créé :
 *   - l'utilisateur courant appartient à la company de la demande
 *   - la commande est en statut `delivered` ou `invoiced` (choix produit :
 *     paiement après livraison, pas à l'acceptation du devis)
 *   - le traiteur a un compte Stripe actif (payouts_enabled = true)
 *   - aucun paiement `succeeded` n'existe déjà pour cette commande
 */
export async function createOrderCheckoutSession(
  orderId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  // Récupère l'ordre + devis + traiteur. La RLS s'assure que seul un user
  // autorisé voit cette commande.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (supabase as any)
    .from("orders")
    .select(`
      id, status,
      quotes!inner (
        id, total_amount_ht,
        caterers ( id, name, commission_rate, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled )
      )
    `)
    .eq("id", orderId)
    .single();

  if (!orderRaw) return { ok: false, error: "Commande introuvable" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderRaw as any;
  const quote = order.quotes;
  const caterer = quote?.caterers;

  // ── Vérifs ─────────────────────────────────────────────────
  const payableStatuses = ["delivered", "invoiced"];
  if (!payableStatuses.includes(order.status)) {
    return {
      ok: false,
      error: "Cette commande ne peut pas être payée dans son état actuel.",
    };
  }

  if (!caterer?.stripe_account_id) {
    return {
      ok: false,
      error:
        "Le traiteur n'a pas encore configuré ses paiements Stripe. Contactez-le ou réessayez plus tard.",
    };
  }
  if (!caterer.stripe_payouts_enabled) {
    return {
      ok: false,
      error:
        "Le compte Stripe du traiteur n'est pas entièrement validé. Il devra finaliser son onboarding avant que le paiement soit possible.",
    };
  }

  // Empêche le double paiement : si un `payments.status = succeeded` existe déjà
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingPayments } = await (admin as any)
    .from("payments")
    .select("id, status")
    .eq("order_id", orderId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((existingPayments ?? []).some((p: any) => p.status === "succeeded")) {
    return { ok: false, error: "Cette commande est déjà payée." };
  }

  // ── Calcul des montants ─────────────────────────────────────
  const totalHt = Number(quote.total_amount_ht ?? 0);
  if (!Number.isFinite(totalHt) || totalHt <= 0) {
    return { ok: false, error: "Montant du devis invalide." };
  }

  const amountTotalCents = euroToCents(totalHt);
  const applicationFeeCents = computeApplicationFeeCents(
    amountTotalCents,
    caterer.commission_rate,
  );
  const amountToCatererCents = amountTotalCents - applicationFeeCents;

  // ── URL de base pour success/cancel ─────────────────────────
  const hdrs = await headers();
  let origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!origin) {
    const originHeader = hdrs.get("origin");
    if (originHeader) {
      origin = originHeader;
    } else {
      const host = hdrs.get("host") ?? "localhost:3000";
      const protocol = host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https";
      origin = `${protocol}://${host}`;
    }
  }

  // ── Création de la Checkout Session Stripe ──────────────────
  const stripe = getStripeClient();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount: amountTotalCents,
            product_data: {
              name: `Commande ${caterer.name}`,
              description: `Règlement de la prestation`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: caterer.stripe_account_id,
        },
      },
      success_url: `${origin}/client/orders/${orderId}?payment=success`,
      cancel_url: `${origin}/client/orders/${orderId}?payment=cancelled`,
      client_reference_id: orderId,
      metadata: {
        order_id: orderId,
        caterer_id: caterer.id,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Création du paiement échouée : ${msg}` };
  }

  // ── Trace l'intention dans la table payments ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (admin as any).from("payments").insert({
    order_id: orderId,
    caterer_id: caterer.id,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: (session.payment_intent as string | null) ?? null,
    status: "pending",
    amount_total_cents: amountTotalCents,
    application_fee_cents: applicationFeeCents,
    amount_to_caterer_cents: amountToCatererCents,
    currency: STRIPE_CURRENCY,
  });

  if (insertErr) {
    console.error("[createOrderCheckoutSession] insert payments failed:", insertErr);
    // On ne bloque pas le flow — le webhook est la source de vérité et mettra
    // à jour ou créera la ligne à son arrivée.
  }

  if (!session.url) {
    return { ok: false, error: "URL de paiement non renvoyée par Stripe." };
  }

  return { ok: true, url: session.url };
}

/**
 * Synchronise l'état du paiement depuis Stripe (sans attendre le webhook).
 *
 * Utile quand le webhook n'arrive pas (dev local sans `stripe listen`,
 * endpoint mal configuré, erreur transitoire). Côté UX, c'est aussi un
 * filet de sécurité pour éviter qu'un client reste bloqué sur "Paiement
 * en cours de traitement" si la synchro asynchrone a raté.
 */
export async function refreshOrderPaymentStatus(
  orderId: string,
): Promise<{ ok: true; paid: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  // L'RLS sur orders garantit que seul un user autorisé passe ici.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (supabase as any)
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRaw) return { ok: false, error: "Commande introuvable" };

  const admin = createAdminClient();

  // Récupère la dernière tentative de paiement pour cette commande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentRaw } = await (admin as any)
    .from("payments")
    .select("id, stripe_checkout_session_id, stripe_payment_intent_id, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payment = paymentRaw as {
    id: string;
    stripe_checkout_session_id: string | null;
    stripe_payment_intent_id: string | null;
    status: string;
  } | null;
  if (!payment) return { ok: false, error: "Aucun paiement à synchroniser" };

  const stripe = getStripeClient();

  try {
    // Re-fetch la Checkout Session pour connaître son statut réel
    if (!payment.stripe_checkout_session_id) {
      return { ok: false, error: "Pas de session Stripe à synchroniser" };
    }
    const session = await stripe.checkout.sessions.retrieve(
      payment.stripe_checkout_session_id,
    );

    const paymentStatus = session.payment_status;
    const succeeded = paymentStatus === "paid" || paymentStatus === "no_payment_required";
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("payments")
      .update({
        status: succeeded ? "succeeded" : paymentStatus === "unpaid" ? "pending" : "processing",
        stripe_payment_intent_id: (session.payment_intent as string | null) ?? payment.stripe_payment_intent_id,
        succeeded_at: succeeded ? now : null,
        last_event_at: now,
      })
      .eq("id", payment.id);

    if (succeeded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("orders").update({ status: "paid" }).eq("id", orderId);
    }

    revalidatePath(`/client/orders/${orderId}`);

    return { ok: true, paid: succeeded };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Synchro Stripe échouée : ${msg}` };
  }
}
