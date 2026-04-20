/**
 * Constantes et helpers métier pour l'intégration Stripe.
 */

export const STRIPE_CURRENCY = "eur";
export const STRIPE_CONNECTED_ACCOUNT_COUNTRY = "FR";

/**
 * Taux de commission plateforme par défaut si le traiteur n'a pas de
 * commission_rate renseignée (en pourcentage, pas en fraction).
 */
export const DEFAULT_PLATFORM_COMMISSION_RATE = 10;

/**
 * Convertit un montant HT (en euros, ex: 1250.50) en centimes pour Stripe.
 */
export function euroToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Calcule la commission plateforme (en centimes) à partir d'un montant total
 * (en centimes) et d'un taux (en pourcentage).
 */
export function computeApplicationFeeCents(
  totalCents: number,
  commissionRatePercent: number | null | undefined,
): number {
  const rate = commissionRatePercent ?? DEFAULT_PLATFORM_COMMISSION_RATE;
  return Math.round((totalCents * rate) / 100);
}
