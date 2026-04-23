"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Déclaration par le client qu'un virement bancaire a été émis pour
 * régler la facture de cette commande.
 *
 * Flow produit :
 *   - Le client coche "Je confirme avoir émis un virement de X €"
 *   - Il clique sur "J'ai effectué le virement"
 *   - On stocke le timestamp dans `orders.bank_transfer_declared_at`
 *   - La carte virement passe en mode "Virement déclaré — en cours"
 *   - Le statut UI affiche "Virement en cours" jusqu'à réception Stripe
 *
 * Contraintes :
 *   - Seul un user autorisé (créateur commande OU admin company) peut
 *     déclarer — la RLS sur orders filtre automatiquement.
 *   - La commande doit être dans un statut payable (delivered/invoiced)
 *     pour éviter qu'un client déclare un virement sur une commande
 *     déjà payée ou pas encore facturée.
 *   - Idempotent : redéclarer ne fait rien (on garde la 1ère déclaration).
 */
export async function declareBankTransferAction(formData: FormData) {
  const orderId = formData.get("order_id") as string | null;
  if (!orderId) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Vérif : l'ordre doit être visible (RLS) + payable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRow } = await (supabase as any)
    .from("orders")
    .select("id, status, bank_transfer_declared_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow) return;

  const typed = orderRow as {
    status: string;
    bank_transfer_declared_at: string | null;
  };

  // Statut payable = delivered ou invoiced (même contrainte que le flow
  // Stripe Checkout dans pay/actions.ts).
  const payableStatuses = ["delivered", "invoiced"];
  if (!payableStatuses.includes(typed.status)) {
    console.warn(
      `[declareBankTransferAction] order ${orderId} not payable (status=${typed.status})`,
    );
    return;
  }

  // Idempotence : si déjà déclaré, on ne touche pas. Évite d'écraser
  // la date du 1er clic (qui sert de référence "virement émis le").
  if (typed.bank_transfer_declared_at) {
    revalidatePath(`/client/orders/${orderId}`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ bank_transfer_declared_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    console.error("[declareBankTransferAction] update failed:", error);
    return;
  }

  revalidatePath(`/client/orders/${orderId}`);
}

/**
 * Annule la déclaration de virement — remet `bank_transfer_declared_at`
 * à NULL. Le statut UI repasse à "À payer".
 *
 * Cas d'usage : le client a cliqué par erreur, ou il a finalement
 * annulé son virement depuis sa banque.
 *
 * Garde-fou : si la commande est déjà `paid` (webhook Stripe passé),
 * annuler la déclaration n'a plus aucun sens — on no-op.
 */
export async function cancelBankTransferDeclarationAction(formData: FormData) {
  const orderId = formData.get("order_id") as string | null;
  if (!orderId) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRow } = await (supabase as any)
    .from("orders")
    .select("id, status, bank_transfer_declared_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow) return;

  const typed = orderRow as {
    status: string;
    bank_transfer_declared_at: string | null;
  };

  // Si la commande est déjà payée, on ne doit pas permettre d'annuler.
  if (typed.status === "paid") {
    console.warn(
      `[cancelBankTransferDeclarationAction] order ${orderId} already paid — no-op`,
    );
    return;
  }

  // Rien à annuler si pas de déclaration — no-op silencieux.
  if (!typed.bank_transfer_declared_at) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ bank_transfer_declared_at: null })
    .eq("id", orderId);

  if (error) {
    console.error("[cancelBankTransferDeclarationAction] update failed:", error);
    return;
  }

  revalidatePath(`/client/orders/${orderId}`);
}
