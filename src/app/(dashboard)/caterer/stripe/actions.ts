"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/server";
import { STRIPE_CONNECTED_ACCOUNT_COUNTRY } from "@/lib/stripe/constants";

/**
 * Crée (si besoin) le compte Stripe Connect V2 du traiteur courant puis
 * retourne un lien d'onboarding hébergé Stripe.
 *
 * Le blueprint Stripe "Collectez les paiements avec Accounts V2 comme
 * marketplace" impose :
 *   - Dashboard "express"
 *   - Capabilities stripe_balance.stripe_transfers demandé
 *   - losses_collector et fees_collector = "application" (plateforme)
 *   - use_case.type = "account_onboarding" sur le lien
 */
export async function createCatererOnboardingLink(): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  // Récupère le traiteur rattaché au user
  const { data: profile } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user.id)
    .single();
  const catererId = (profile as { caterer_id: string | null } | null)?.caterer_id;
  if (!catererId) return { ok: false, error: "Aucun traiteur rattaché à ce compte" };

  // Service role pour lire/écrire `caterers.stripe_account_id`
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererRaw } = await (admin as any)
    .from("caterers")
    .select("id, name, stripe_account_id")
    .eq("id", catererId)
    .single();
  if (!catererRaw) return { ok: false, error: "Traiteur introuvable" };
  const caterer = catererRaw as {
    id: string;
    name: string;
    stripe_account_id: string | null;
  };

  const stripe = getStripeClient();
  let stripeAccountId = caterer.stripe_account_id;

  // 1. Crée le compte V2 si pas encore fait
  if (!stripeAccountId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (stripe as any).v2.core.accounts.create({
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        display_name: caterer.name,
        contact_email: user.email,
        defaults: {
          responsibilities: {
            losses_collector: "application",
            fees_collector: "application",
          },
        },
        dashboard: "express",
        include: [
          "configuration.merchant",
          "configuration.recipient",
          "identity",
          "defaults",
          "configuration.customer",
        ],
        identity: {
          country: STRIPE_CONNECTED_ACCOUNT_COUNTRY,
        },
      });

      stripeAccountId = account.id as string;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (admin as any)
        .from("caterers")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", caterer.id);

      if (updateErr) {
        return { ok: false, error: `Sauvegarde de l'id Stripe échouée : ${updateErr.message}` };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Création du compte Stripe échouée : ${msg}` };
    }
  }

  // 2. Crée le lien d'onboarding
  //
  // L'URL de retour doit être publiquement accessible (https://) OU
  // être http://localhost:PORT en mode TEST Stripe uniquement.
  //
  // Ordre de préférence :
  //   1. NEXT_PUBLIC_SITE_URL (à définir dans .env.local / Vercel)
  //   2. origin header de la requête (utile derrière un proxy)
  //   3. host header de la requête (fallback)
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
  console.log("[stripe-onboarding] origin utilisé:", origin);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = await (stripe as any).v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          // Doit correspondre aux configurations réellement appliquées au
          // compte lors de sa création (ici : recipient uniquement, puisqu'on
          // fait des Destination charges — la plateforme est le merchant).
          configurations: ["recipient"],
          refresh_url: `${origin}/caterer/stripe?status=refresh`,
          return_url: `${origin}/caterer/stripe/complete`,
        },
      },
    });

    return { ok: true, url: link.url as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Création du lien d'onboarding échouée : ${msg}` };
  }
}
