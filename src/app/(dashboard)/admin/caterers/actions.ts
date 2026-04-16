"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Valider un compte traiteur ──────────────────────────────────

export async function validateCatererAction(formData: FormData) {
  const catererId = formData.get("caterer_id") as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  await supabase
    .from("caterers")
    .update({ is_validated: true })
    .eq("id", catererId);

  revalidatePath("/admin/caterers");
  revalidatePath(`/admin/caterers/${catererId}`);
}

// ── Rejeter / désactiver un compte traiteur ─────────────────────

export async function rejectCatererAction(formData: FormData) {
  const catererId = formData.get("caterer_id") as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  await supabase
    .from("caterers")
    .update({ is_validated: false })
    .eq("id", catererId);

  revalidatePath("/admin/caterers");
  revalidatePath(`/admin/caterers/${catererId}`);
}
