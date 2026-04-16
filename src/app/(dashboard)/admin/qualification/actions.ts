"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Approuver une demande et l'attribuer à des traiteurs ────────

export async function approveRequestAction(formData: FormData) {
  const requestId  = formData.get("request_id") as string;
  const catererIds = formData.getAll("caterer_ids") as string[];
  const notes      = formData.get("notes") as string | null;

  if (!catererIds.length) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Créer les entrées quote_request_caterers
  const { error: qrcError } = await supabase
    .from("quote_request_caterers")
    .insert(
      catererIds.map((catererId) => ({
        quote_request_id: requestId,
        caterer_id:       catererId,
        status:           "selected",
      }))
    );

  if (qrcError) throw new Error(qrcError.message);

  // Mettre à jour le statut de la demande
  const { error: reqError } = await supabase
    .from("quote_requests")
    .update({
      status:            "sent_to_caterers",
      ...(notes ? { super_admin_notes: notes } : {}),
    })
    .eq("id", requestId);

  if (reqError) throw new Error(reqError.message);

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
