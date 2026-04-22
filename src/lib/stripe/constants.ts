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

// ── Frais de mise en relation (commission plateforme) ─────────────
// Modèle B2B "commission ajoutée" : le traiteur émet son devis pour le
// montant qu'il veut toucher net ; la plateforme ajoute 5% HT en sus
// (soumis à TVA 20% car prestation de service standard). Le client paie
// donc `devis_TTC + frais_TTC`.
//
// On sépare ces constantes "display + facturation" des calculs
// techniques (computeApplicationFeeCents, qui peut un jour diverger si
// la commission devient négociable par traiteur).

export const PLATFORM_FEE_RATE_DISPLAY = 0.05;   // 5% HT sur le HT du devis
export const PLATFORM_FEE_TVA_RATE     = 20;     // TVA 20% sur la commission
export const PLATFORM_FEE_LABEL        = "Frais de mise en relation";

/**
 * Montant HT des frais de mise en relation pour un devis donné.
 * `quoteTotalHt` : total HT du devis traiteur (quote.total_amount_ht).
 */
export function computePlatformFeeHt(quoteTotalHt: number): number {
  return Math.round(quoteTotalHt * PLATFORM_FEE_RATE_DISPLAY * 100) / 100;
}

/**
 * Montant TVA des frais de mise en relation.
 */
export function computePlatformFeeTva(quoteTotalHt: number): number {
  const ht = computePlatformFeeHt(quoteTotalHt);
  return Math.round(ht * PLATFORM_FEE_TVA_RATE) / 100;
}

/**
 * Montant TTC des frais de mise en relation (ce que le client paie en sus
 * du devis, ce que la plateforme garde via application_fee_amount).
 */
export function computePlatformFeeTtc(quoteTotalHt: number): number {
  return (
    Math.round(
      (computePlatformFeeHt(quoteTotalHt) + computePlatformFeeTva(quoteTotalHt)) * 100,
    ) / 100
  );
}

/** Alias conservé pour les quelques endroits qui affichent la commission
 *  sans se préoccuper de la TVA (wizard récap, QuoteCard). Par défaut on
 *  montre désormais le TTC, qui est ce que le client paie réellement. */
export function computePlatformFeeDisplay(quoteTotalHt: number): number {
  return computePlatformFeeTtc(quoteTotalHt);
}

// ── Référence facture ↔ devis ─────────────────────────────────────
// Convention : `DEVIS-2026-042` ↔ `FAC-2026-042`. On ne change que le
// préfixe, le numéro et l'année restent alignés pour qu'une facture
// soit immédiatement identifiable à son devis source.
//
// Si le devis a une référence "hors convention" (legacy, saisie manuelle),
// on préfixe avec `FAC-` pour garder une ref cohérente côté Stripe.

export function deriveInvoiceReference(quoteReference: string | null | undefined): string | null {
  if (!quoteReference) return null;
  const trimmed = quoteReference.trim();
  if (!trimmed) return null;

  // Cas standard : DEVIS[-/_]… → FAC[-/_]…
  if (/^DEVIS[-_/ ]/i.test(trimmed)) {
    return trimmed.replace(/^DEVIS/i, "FAC");
  }
  // Cas sans séparateur (DEVIS2026042)
  if (/^DEVIS/i.test(trimmed)) {
    return trimmed.replace(/^DEVIS/i, "FAC");
  }
  // Fallback : ref libre — on préfixe
  return `FAC-${trimmed}`;
}
