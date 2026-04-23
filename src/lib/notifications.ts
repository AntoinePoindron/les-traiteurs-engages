import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers centralisés pour la création de notifications in-app.
 *
 * Règles :
 *  - On utilise systématiquement le service-role (`createAdminClient`)
 *    ou un client déjà instancié pour éviter les soucis de RLS — la
 *    policy `notifications_insert` limite l'INSERT au service-role.
 *  - Les erreurs sont loggées, jamais `throw` : une notification qui
 *    ne part pas ne doit pas bloquer le flow métier (ex. accepter un
 *    devis ne doit pas échouer parce que l'INSERT notif a merdé).
 *  - La table notifications a 9 colonnes, dont 2 optionnelles
 *    (`related_entity_type`, `related_entity_id`). `is_read` default
 *    à false côté DB, on ne le passe jamais.
 *
 * Catalogue des `type` utilisés dans l'app (à garder en sync avec
 * `NOTIF_ICONS` et `getNotifHref` dans `components/layout/Sidebar.tsx`) :
 *
 *   Traiteur :
 *     - quote_request_received   : demande de devis assignée (après qualif)
 *     - quote_accepted           : client accepte mon devis
 *     - quote_refused            : client refuse mon devis
 *     - order_cancelled          : client annule une commande (non implémenté)
 *     - invoice_paid             : paiement reçu (webhook Stripe)
 *     - payment_failed           : échec paiement (webhook Stripe)
 *     - dispute_opened           : litige ouvert (non implémenté)
 *
 *   Client :
 *     - quote_received           : un traiteur a envoyé un devis
 *     - order_delivered          : commande livrée + facture émise
 *                                  (événements groupés depuis qu'on ne
 *                                  les sépare plus — cf. lib/stripe/invoices.ts)
 *     - collaborator_pending     : (admin uniquement) collab attend valid
 *     - collaborator_approved    : je suis validé pour rejoindre la boîte
 *
 *   Legacy (types qu'on n'émet plus, mais qu'on garde typés car il
 *   peut en rester en DB le temps d'être consommés/dismissés) :
 *     - invoice_issued           : remplacé par order_delivered groupé
 *
 *   Super-admin :
 *     - new_caterer_signup       : nouveau traiteur à qualifier
 *     - new_request_to_qualify   : nouvelle demande client à qualifier
 *     - dispute_opened_admin     : litige à arbitrer (non implémenté)
 */

export type NotificationType =
  // caterer
  | "quote_request_received"
  | "quote_accepted"
  | "quote_refused"
  | "order_cancelled"
  | "invoice_paid"
  | "payment_failed"
  | "dispute_opened"
  // client
  | "quote_received"
  | "order_delivered"
  | "invoice_issued"
  | "collaborator_pending"
  | "collaborator_approved"
  // super-admin
  | "new_caterer_signup"
  | "new_request_to_qualify"
  | "dispute_opened_admin";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

/**
 * Insère une notification pour un utilisateur. Ne throw jamais —
 * log l'erreur et continue. Accepte un client optionnel pour réutiliser
 * un admin déjà instancié (ex. dans les webhooks Stripe).
 */
export async function createNotification(
  input: CreateNotificationInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>,
): Promise<void> {
  const db = client ?? createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
  });
  if (error) {
    console.error(`[notifications] insert failed (type=${input.type}):`, error);
  }
}

/**
 * Insère la même notification pour tous les super-admins. Utilisé pour
 * les events à arbitrer (nouvelle demande à qualifier, nouveau traiteur
 * inscrit, litige ouvert).
 */
export async function notifySuperAdmins(
  input: Omit<CreateNotificationInput, "userId">,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>,
): Promise<void> {
  const db = client ?? createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admins, error: listErr } = await (db as any)
    .from("users")
    .select("id")
    .eq("role", "super_admin");

  if (listErr) {
    console.error("[notifications] fetch super_admins failed:", listErr);
    return;
  }

  const rows = (admins ?? []).map((a: { id: string }) => ({
    user_id: a.id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
  }));

  if (rows.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("notifications").insert(rows);
  if (error) {
    console.error("[notifications] bulk insert super_admins failed:", error);
  }
}

/**
 * Supprime les notifications d'un user pour un/plusieurs types donnés,
 * optionnellement scopées à une entité (related_entity_id).
 *
 * Appelée depuis les pages cibles — dès que l'utilisateur consulte la
 * demande/commande/page concernée (par n'importe quel moyen : clic notif,
 * lien dashboard, URL directe), les notifs correspondantes disparaissent
 * automatiquement.
 *
 * Exemples d'usage :
 *   - Page détail commande côté traiteur :
 *     dismissNotifications({ userId, types: ["quote_accepted","invoice_paid","payment_failed"], entityId: orderId })
 *   - Page qualification admin (liste) :
 *     dismissNotifications({ userId, types: ["new_caterer_signup","new_request_to_qualify"] })
 *
 * Ne throw jamais — log et continue.
 */
export async function dismissNotifications(params: {
  userId: string;
  types: NotificationType[];
  entityId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any, any, any>;
}): Promise<void> {
  if (!params.userId || params.types.length === 0) return;

  const db = params.client ?? createAdminClient();

  // On ajoute `.select()` pour récupérer les lignes supprimées → ça
  // permet de logger précisément combien de notifs ont été dégagées
  // et d'identifier les cas où le match ne fonctionne pas (0 ligne
  // supprimée alors qu'on s'attendait à une).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (db as any)
    .from("notifications")
    .delete()
    .eq("user_id", params.userId)
    .in("type", params.types);

  if (params.entityId) {
    q = q.eq("related_entity_id", params.entityId);
  }

  q = q.select("id, type, related_entity_id");

  const { data, error } = await q;
  if (error) {
    console.error(
      `[notifications] dismiss failed (types=${params.types.join(",")}):`,
      error,
    );
    return;
  }

  const count = Array.isArray(data) ? data.length : 0;
  console.log(
    `[notifications] dismiss user=${params.userId.slice(0, 8)} types=[${params.types.join(",")}] entity=${params.entityId ?? "*"} → ${count} supprimée(s)`,
  );
}
