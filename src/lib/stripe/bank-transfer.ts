import "server-only";

import { getStripeClient } from "./server";

/**
 * Récupère les instructions de virement bancaire (IBAN virtuel Stripe)
 * pour un customer donné.
 *
 * Stripe crée un compte virtuel bancaire unique par customer (flow
 * `customer_balance` + `bank_transfer` type `eu_bank_transfer`). Le
 * client transfère de l'argent vers cet IBAN → Stripe crédite son
 * cash balance → la facture en cours est réglée automatiquement depuis
 * ce crédit. Pas de référence à ajouter au virement — le matching
 * se fait par IBAN destinataire (unique par customer).
 *
 * `createFundingInstructions` est idempotent : le même customer obtient
 * toujours le même IBAN, peu importe le nombre d'appels.
 */
export interface BankTransferInstructions {
  iban: string;
  bic: string;
  accountHolderName: string;
  bankName: string | null;
  country: string;
}

export async function getBankTransferInstructions(
  customerId: string,
): Promise<
  | { ok: true; instructions: BankTransferInstructions }
  | { ok: false; error: string }
> {
  const stripe = getStripeClient();

  try {
    const result = await stripe.customers.createFundingInstructions(
      customerId,
      {
        funding_type: "bank_transfer",
        bank_transfer: {
          type: "eu_bank_transfer",
          eu_bank_transfer: { country: "FR" },
        },
        currency: "eur",
      },
    );

    // Structure de retour Stripe :
    // { bank_transfer: { financial_addresses: [{ type: "iban", iban: {...} }] } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bt = (result as any).bank_transfer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const financialAddress = (bt?.financial_addresses ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => a.type === "iban",
    );
    const ibanDetails = financialAddress?.iban;

    if (!ibanDetails?.iban || !ibanDetails?.bic) {
      return {
        ok: false,
        error: "Stripe n'a pas renvoyé d'IBAN pour ce customer.",
      };
    }

    return {
      ok: true,
      instructions: {
        iban: ibanDetails.iban,
        bic: ibanDetails.bic,
        accountHolderName: ibanDetails.account_holder_name ?? "Stripe Payments",
        bankName: ibanDetails.bank_name ?? null,
        country: ibanDetails.country ?? "",
      },
    };
  } catch (e) {
    // Certains customers n'ont pas encore de funding instructions si
    // aucune invoice n'a utilisé customer_balance — on gère le cas.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[bank-transfer] funding instructions failed:", msg);
    return { ok: false, error: msg };
  }
}
