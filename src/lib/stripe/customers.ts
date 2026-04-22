import "server-only";

import { getStripeClient } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Récupère (ou crée et stocke) le Stripe Customer rattaché au user.
 *
 * Les factures Stripe nécessitent un Customer — on le crée à la volée lors
 * de la première facture d'un client, et on réutilise le même pour toutes
 * ses commandes suivantes. Stripe agrège ainsi son historique et ses
 * méthodes de paiement.
 */
export async function getOrCreateStripeCustomerForUser(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  siret?: string | null;
}): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // Lookup en DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRow } = await (admin as any)
    .from("users")
    .select("stripe_customer_id")
    .eq("id", params.userId)
    .single();

  const existing = (userRow as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (existing) {
    return { ok: true, customerId: existing };
  }

  // Création Stripe
  const stripe = getStripeClient();
  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.fullName ?? params.email,
      metadata: {
        user_id: params.userId,
        company_name: params.companyName ?? "",
        siret: params.siret ?? "",
      },
    });

    // Persist en DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("users")
      .update({ stripe_customer_id: customer.id })
      .eq("id", params.userId);

    if (error) {
      // Le Customer Stripe est créé mais on a pas pu le persister — log et on
      // renvoie quand même l'id, la prochaine fois on recréera un doublon
      // (acceptable en dev). À nettoyer si ça arrive en prod.
      console.error("[stripe-customers] persist failed:", error);
    }

    return { ok: true, customerId: customer.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Création du Customer Stripe échouée : ${msg}` };
  }
}
