import Stripe from "stripe";

/**
 * Client Stripe côté serveur (service role).
 * Ne jamais importer depuis un composant client.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY manquante. Ajoute-la dans .env.local (et sur Vercel pour la prod)."
    );
  }
  // On laisse l'apiVersion par défaut du SDK (blueprint recommande de ne pas
  // la surcharger sauf besoin spécifique).
  return new Stripe(key);
}
