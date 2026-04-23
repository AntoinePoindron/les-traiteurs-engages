import "server-only";

import type Stripe from "stripe";
import { getStripeClient } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomerForUser } from "./customers";
import { createNotification } from "@/lib/notifications";
import {
  STRIPE_CURRENCY,
  euroToCents,
  computePlatformFeeHt,
  computePlatformFeeTtc,
  deriveInvoiceReference,
  PLATFORM_FEE_LABEL,
  PLATFORM_FEE_TVA_RATE,
  PLATFORM_FEE_RATE_DISPLAY,
} from "./constants";

// ── TaxRate helper ─────────────────────────────────────────────────
// Stripe utilise des objets TaxRate (`txr_…`) à attacher sur les
// InvoiceItems pour que la TVA apparaisse correctement sur la facture
// (avec le %, le jurisdiction, etc.). On les crée à la demande et on
// les mémoïse en mémoire le temps du process pour éviter de les
// recréer à chaque facture.

const taxRateCache: Record<string, string> = {};

async function ensureTaxRateId(stripe: Stripe, percentage: number): Promise<string> {
  const key = `fr_${percentage}`;
  if (taxRateCache[key]) return taxRateCache[key];

  // Cherche un TaxRate existant qui matche (au cas où il a déjà été
  // créé par une exécution précédente — mémoire perdue à chaque redémarrage).
  const list = await stripe.taxRates.list({ limit: 100, active: true });
  const existing = list.data.find(
    (r) =>
      r.percentage === percentage &&
      r.inclusive === false &&
      (r.country === "FR" || r.jurisdiction === "FR") &&
      r.metadata?.managed_by === "les-traiteurs-engages",
  );
  if (existing) {
    taxRateCache[key] = existing.id;
    return existing.id;
  }

  const created = await stripe.taxRates.create({
    display_name: "TVA",
    description: `TVA ${percentage} % France`,
    jurisdiction: "FR",
    country: "FR",
    percentage,
    inclusive: false,
    metadata: { managed_by: "les-traiteurs-engages" },
  });
  taxRateCache[key] = created.id;
  return created.id;
}

/**
 * Génère et envoie une facture Stripe officielle pour une commande livrée.
 *
 * Flow (invoice-first) :
 *   1. On récupère (ou crée) le Stripe Customer rattaché au client.
 *   2. On crée des Invoice Items — un par ligne du devis — rattachés au customer.
 *   3. On crée l'Invoice avec :
 *        - collection_method: "send_invoice" (le client paie depuis la hosted
 *          invoice page, pas une Checkout Session)
 *        - days_until_due: 30 (échéance B2B standard)
 *        - payment_settings.payment_method_types: ["card", "customer_balance"]
 *          (carte + virement SEPA via compte virtuel Stripe)
 *        - application_fee_amount / transfer_data.destination : destination
 *          charge vers le compte connecté du traiteur (même modèle que Checkout).
 *        - custom_fields : nom, SIRET et adresse du traiteur, pour que le
 *          client voie bien qui a fait la prestation malgré la plateforme
 *          comme émetteur officiel.
 *   4. On finalise (l'Invoice passe de "draft" à "open") et Stripe envoie
 *      le mail avec la hosted invoice page.
 *   5. On persiste stripe_invoice_id / stripe_hosted_invoice_url sur la
 *      commande et on passe son statut à "invoiced".
 *
 * Appelée automatiquement quand le traiteur marque la commande comme livrée.
 * Idempotente : si la commande a déjà une stripe_invoice_id, on ne recrée
 * pas de facture — on renvoie simplement l'URL existante.
 */
export async function generateOrderInvoice(
  orderId: string,
): Promise<
  | { ok: true; invoiceId: string; hostedInvoiceUrl: string | null; alreadyExisted: boolean }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();

  // ── Récupère la commande + devis + traiteur + demande + client ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw } = await (admin as any)
    .from("orders")
    .select(`
      id, status, stripe_invoice_id, stripe_hosted_invoice_url,
      quotes!inner (
        id, reference, total_amount_ht, details, notes,
        caterers (
          id, name, siret, address, city, zip_code, commission_rate,
          stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
        ),
        quote_requests!inner (
          id, title,
          companies ( name, siret ),
          users ( id, email, first_name, last_name )
        )
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRaw) return { ok: false, error: "Commande introuvable." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = orderRaw as any;
  const quote = order.quotes;
  const caterer = quote?.caterers;
  const qr = quote?.quote_requests;
  const clientUser = qr?.users;
  const company = qr?.companies;

  // ── Idempotence : facture déjà émise ? ──────────────────────────────
  if (order.stripe_invoice_id) {
    return {
      ok: true,
      invoiceId: order.stripe_invoice_id,
      hostedInvoiceUrl: order.stripe_hosted_invoice_url ?? null,
      alreadyExisted: true,
    };
  }

  // ── Vérifs métier ───────────────────────────────────────────────────
  if (!caterer?.stripe_account_id) {
    return {
      ok: false,
      error:
        "Le traiteur n'a pas encore configuré ses paiements Stripe. La facture ne peut pas être émise.",
    };
  }
  if (!caterer.stripe_charges_enabled || !caterer.stripe_payouts_enabled) {
    return {
      ok: false,
      error:
        "Le compte Stripe du traiteur n'est pas entièrement validé. Il doit finaliser son onboarding avant qu'une facture puisse être émise.",
    };
  }
  if (!clientUser?.id || !clientUser?.email) {
    return { ok: false, error: "Client introuvable sur la commande." };
  }

  const totalHt = Number(quote.total_amount_ht ?? 0);
  if (!Number.isFinite(totalHt) || totalHt <= 0) {
    return { ok: false, error: "Montant du devis invalide." };
  }

  // ── Stripe Customer du client ───────────────────────────────────────
  const fullName =
    `${clientUser.first_name ?? ""} ${clientUser.last_name ?? ""}`.trim() || null;

  const customerResult = await getOrCreateStripeCustomerForUser({
    userId: clientUser.id,
    email: clientUser.email,
    fullName,
    companyName: company?.name ?? null,
    siret: company?.siret ?? null,
  });
  if (!customerResult.ok) {
    return { ok: false, error: customerResult.error };
  }
  const customerId = customerResult.customerId;

  // ── Calcul des totaux ─────────────────────────────────────────────
  // Modèle "frais ajoutés au devis" :
  //   - prestation_HT   = total HT du devis (ce que le traiteur veut toucher)
  //   - prestation_TVA  = TVA par item du devis
  //   - fee_HT          = 5% × prestation_HT (commission plateforme)
  //   - fee_TVA         = 20% × fee_HT (TVA standard sur prestation de service)
  //   - total_client_TTC = prestation_TTC + fee_TTC  ← ce que Stripe charge
  //   - application_fee  = fee_TTC (ce que Stripe retient pour la plateforme,
  //                        le reste part sur le compte connecté du traiteur)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = quote.details ?? [];

  const feeHt  = computePlatformFeeHt(totalHt);
  const feeTtc = computePlatformFeeTtc(totalHt);

  const applicationFeeCents = euroToCents(feeTtc);

  // ── Création de la facture Stripe ───────────────────────────────────
  const stripe = getStripeClient();

  // Réf facture dérivée de la réf devis (DEVIS-YYYY-NNN → FAC-YYYY-NNN).
  // On la passe en `number` à Stripe (cf. `stripe.invoices.create` plus
  // bas) pour qu'elle apparaisse comme numéro officiel de la facture —
  // aussi bien dans le mail envoyé au client que sur le PDF et la
  // hosted invoice page, à la place du numéro auto-généré "IN-xxx" /
  // "RE…-xxx" de Stripe.
  const invoiceReference = deriveInvoiceReference(quote.reference);

  // Custom fields : max 4 côté Stripe. Plus besoin de la ligne
  // "Facture" (elle sort maintenant comme numéro principal de la
  // facture) — on priorise la réf devis source + identité traiteur.
  const customFieldCandidates: Array<{ name: string; value: string } | null> = [
    quote.reference
      ? { name: "Devis", value: String(quote.reference).slice(0, 30) }
      : null,
    { name: "Traiteur", value: (caterer.name ?? "").slice(0, 30) },
    caterer.siret
      ? { name: "SIRET traiteur", value: String(caterer.siret).slice(0, 30) }
      : null,
    caterer.city
      ? {
          name: "Adresse traiteur",
          value: [caterer.address, caterer.zip_code, caterer.city]
            .filter(Boolean)
            .join(", ")
            .slice(0, 30),
        }
      : null,
  ];
  const customFields = customFieldCandidates
    .filter((c): c is { name: string; value: string } => c !== null)
    .slice(0, 4);

  try {
    // 1) Créer un InvoiceItem par ligne du devis — Stripe les agrègera dans
    //    la facture la plus récente du customer au moment du create.
    //    On range les lignes dans une Invoice draft dédiée pour éviter
    //    toute collision avec d'éventuels autres InvoiceItems non-facturés.
    const invoice = await stripe.invoices.create({
      customer: customerId,
      // Numéro officiel de la facture affiché partout (mail, PDF, hosted
      // page). Contrainte Stripe : unique par compte — notre convention
      // FAC-YYYY-NNN dérivée de la réf devis garantit l'unicité tant
      // qu'un devis n'est pas re-facturé.
      ...(invoiceReference ? { number: invoiceReference } : {}),
      collection_method: "send_invoice",
      days_until_due: 30,
      currency: STRIPE_CURRENCY,
      description: [
        quote.reference ? `Devis source : ${quote.reference}` : null,
        `${caterer.name} — ${qr.title}`,
      ]
        .filter(Boolean)
        .join(" · "),
      // Destination charge : commission plateforme + reversement traiteur
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: caterer.stripe_account_id,
      },
      // Moyens de paiement proposés sur la hosted invoice page :
      // carte (CB/VISA/MC) + virement SEPA via compte virtuel.
      payment_settings: {
        payment_method_types: ["card", "customer_balance"],
        payment_method_options: {
          customer_balance: {
            funding_type: "bank_transfer",
            bank_transfer: {
              type: "eu_bank_transfer",
              eu_bank_transfer: { country: "FR" },
            },
          },
        },
      },
      custom_fields: customFields,
      metadata: {
        order_id: orderId,
        quote_id: quote.id,
        caterer_id: caterer.id,
        client_user_id: clientUser.id,
        quote_reference: quote.reference ?? "",
        invoice_reference: invoiceReference ?? "",
      },
      // auto_advance: true → Stripe tentera automatiquement les relances
      // de paiement sur la carte si elle échoue, mais ne finalize pas tout
      // seul avant qu'on appelle finalizeInvoice (on contrôle le timing).
      auto_advance: true,
    });

    // 2) Lignes détaillées (Invoice Items rattachés à la facture draft)
    //
    // Approche Stripe native : chaque ligne HT porte un `tax_rates`
    // (TaxRate objet txr_…) qui fait que Stripe :
    //   - affiche la TVA correctement (ex. "TVA 10 %") à côté du HT
    //   - calcule et ajoute la TVA au total à payer
    //   - sépare visuellement HT / TVA / TTC sur la hosted invoice page
    //
    // On coerce tout en Number avec fallback à 0 pour éviter les NaN
    // (un champ JSONB manquant faisait planter Stripe en "Invalid
    // integer: NaN").
    const toNum = (v: unknown): number => {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
      return Number.isFinite(n) ? n : 0;
    };

    // Groupe par taux de TVA pour n'avoir qu'une seule ligne "Prestation
    // traiteur" par taux (plus lisible qu'une ligne par item du devis).
    const htByRate: Record<number, number> = {};
    for (const it of items) {
      const qty     = toNum(it.quantity) || 1;
      const unitHt  = toNum(it.unit_price_ht);
      const tvaRate = toNum(it.tva_rate);
      htByRate[tvaRate] = (htByRate[tvaRate] ?? 0) + qty * unitHt;
    }

    // a) Prestations traiteur : 1 ligne HT par taux, avec TaxRate attaché.
    for (const [rateStr, htAmount] of Object.entries(htByRate)) {
      const rate = toNum(rateStr);
      const amountCents = euroToCents(htAmount);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        console.warn("[stripe-invoices] caterer line skipped:", { rate, htAmount });
        continue;
      }
      const taxRateId = rate > 0 ? await ensureTaxRateId(stripe, rate) : null;
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        currency: STRIPE_CURRENCY,
        amount: Math.round(amountCents),
        description: "Prestation traiteur",
        ...(taxRateId ? { tax_rates: [taxRateId] } : {}),
      });
    }

    // b) Frais de mise en relation : 1 ligne HT avec TVA 20% attachée.
    const feeCents = euroToCents(feeHt);
    if (Number.isFinite(feeCents) && feeCents > 0) {
      const feeTaxRateId = await ensureTaxRateId(stripe, PLATFORM_FEE_TVA_RATE);
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        currency: STRIPE_CURRENCY,
        amount: Math.round(feeCents),
        description: `${PLATFORM_FEE_LABEL} (${Math.round(PLATFORM_FEE_RATE_DISPLAY * 100)}%)`,
        tax_rates: [feeTaxRateId],
      });
    }

    // 3) Finaliser + envoyer — Stripe envoie le mail au client avec le
    //    lien vers la hosted invoice page.
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
    let sent = finalized;
    try {
      sent = await stripe.invoices.sendInvoice(invoice.id!);
    } catch (sendErr) {
      // L'envoi du mail peut échouer (customer sans email en mode test
      // trafiqué, etc.) — on ne bloque pas, la facture est finalisée et
      // la hosted URL est utilisable, on la surfacera dans l'app.
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.warn("[stripe-invoices] sendInvoice failed (non-bloquant):", msg);
    }

    const hostedUrl = sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null;

    // 4) Persistance côté BD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (admin as any)
      .from("orders")
      .update({
        stripe_invoice_id: invoice.id,
        stripe_hosted_invoice_url: hostedUrl,
        status: "invoiced",
      })
      .eq("id", orderId);

    if (updErr) {
      console.error("[stripe-invoices] persist failed:", updErr);
      // La facture existe côté Stripe mais on n'a pas pu la rattacher.
      // On renvoie malgré tout les infos — le caterer pourra refaire
      // l'opération, la détection d'idempotence plus haut la bloquera.
    }

    // ── Notifier le client : livraison + facture (notif unique) ──
    // On fusionne ici les 2 événements "prestation livrée" et "facture
    // émise" puisqu'ils vont toujours de paire dans le flow normal
    // (`advanceStatus` → marquage livré → génération facture). Pas
    // d'intérêt à spammer le client avec 2 notifs dos-à-dos.
    //
    // Si la facture avait déjà été générée précédemment (re-trigger
    // manuel après échec auto), `alreadyExisted` aurait été true plus
    // haut et on serait sorti — on n'arrive ici que sur la première
    // émission. En cas de re-trigger après échec, la notif fallback
    // "juste livrée" a été émise côté `advanceStatus`, puis celle-ci
    // arrive en complément — c'est acceptable (2 notifs pour un cas
    // dégradé, 1 notif pour le flow normal).
    const title = invoiceReference
      ? `Prestation livrée - facture ${invoiceReference} disponible`
      : "Prestation livrée - facture disponible";

    await createNotification(
      {
        userId: clientUser.id,
        type: "order_delivered",
        title,
        body: `${caterer.name} a marqué la prestation comme livrée. La facture est prête à être réglée.`,
        relatedEntityType: "order",
        relatedEntityId: orderId,
      },
      admin,
    );

    return {
      ok: true,
      invoiceId: invoice.id!,
      hostedInvoiceUrl: hostedUrl,
      alreadyExisted: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Création de la facture Stripe échouée : ${msg}` };
  }
}
