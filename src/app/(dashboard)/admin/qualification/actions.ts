"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findMatchingCaterers } from "@/lib/caterer-matching";

// ── Approuver une demande en mode "comparer 3 devis" ────────────
// L'admin ne choisit plus les traiteurs : on diffuse à tous ceux qui
// matchent les critères (prestation, capacité, régimes, rayon). Les
// 3 premiers à répondre auront leur devis transmis au client ; le
// trigger SQL `qrc_lock_out_trigger` verrouille les autres (statut
// `closed`) dès qu'un 3ème `transmitted_to_client` apparaît.

export async function approveCompareRequestAction(formData: FormData) {
  const requestId = formData.get("request_id") as string;
  const notes     = formData.get("notes") as string | null;

  if (!requestId) return;

  const admin = createAdminClient();

  // Récupérer les critères de la demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqData, error: reqErr } = await (admin as any)
    .from("quote_requests")
    .select(
      "id, meal_type, guest_count, event_latitude, event_longitude, dietary_vegetarian, dietary_halal, dietary_gluten_free, is_compare_mode, status"
    )
    .eq("id", requestId)
    .single();

  if (reqErr || !reqData) {
    console.error("[approveCompareRequestAction] fetch failed", reqErr);
    throw new Error("Demande introuvable.");
  }
  if (!reqData.is_compare_mode) {
    throw new Error("Cette action est réservée au mode comparer-3.");
  }
  if (reqData.status === "sent_to_caterers") {
    throw new Error("Demande déjà diffusée.");
  }

  const matching = await findMatchingCaterers({
    meal_type:           reqData.meal_type,
    guest_count:         reqData.guest_count,
    event_latitude:      reqData.event_latitude,
    event_longitude:     reqData.event_longitude,
    dietary_vegetarian:  !!reqData.dietary_vegetarian,
    dietary_halal:       !!reqData.dietary_halal,
    dietary_gluten_free: !!reqData.dietary_gluten_free,
  });

  if (matching.length === 0) {
    throw new Error(
      "Aucun traiteur ne correspond aux critères. Revois la demande ou élargis les critères."
    );
  }

  // Créer un qrc 'selected' pour chaque traiteur matchant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: qrcErr } = await (admin as any)
    .from("quote_request_caterers")
    .insert(
      matching.map((c) => ({
        quote_request_id: requestId,
        caterer_id:       c.id,
        status:           "selected",
      }))
    );

  if (qrcErr) {
    console.error("[approveCompareRequestAction] qrc insert failed", qrcErr);
    throw new Error(qrcErr.message);
  }

  // Passer la demande en sent_to_caterers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (admin as any)
    .from("quote_requests")
    .update({
      status:            "sent_to_caterers",
      ...(notes ? { super_admin_notes: notes } : {}),
    })
    .eq("id", requestId);

  if (updateErr) throw new Error(updateErr.message);

  // Notifier chaque traiteur
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catererUsers } = await (admin as any)
    .from("users")
    .select("id, caterer_id")
    .in("caterer_id", matching.map((c) => c.id))
    .eq("role", "caterer");

  const notifs = (catererUsers ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (u: any) => ({
      user_id:             u.id,
      type:                "quote_request_received",
      title:               "Nouvelle demande de devis",
      body:                "Un client vient de déposer une demande correspondant à vos critères.",
      related_entity_type: "quote_request",
      related_entity_id:   requestId,
    })
  );

  if (notifs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("notifications").insert(notifs);
  }

  revalidatePath("/admin/qualification");
  redirect("/admin/qualification");
}

// ── Refuser / annuler une demande ───────────────────────────────

export async function rejectRequestAction(formData: FormData) {
  const requestId = formData.get("request_id") as string;
  const notes     = formData.get("notes") as string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  await supabase
    .from("quote_requests")
    .update({
      status:            "cancelled",
      ...(notes ? { super_admin_notes: notes } : {}),
    })
    .eq("id", requestId);

  revalidatePath("/admin/qualification");
  redirect("/admin/qualification");
}
