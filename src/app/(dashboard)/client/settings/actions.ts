"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCompanyAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[updateCompanyAction] non authentifié");
    return;
  }

  // Vérifier le rôle admin + récupérer company_id
  const { data: profileData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; company_id: string | null } | null;
  if (!profile || profile.role !== "client_admin" || !profile.company_id) {
    console.error("[updateCompanyAction] non autorisé", { role: profile?.role });
    return;
  }

  // Lire et nettoyer les champs
  const name        = (formData.get("name")        as string | null)?.trim() || "";
  const siret       = (formData.get("siret")       as string | null)?.trim() || null;
  const address     = (formData.get("address")     as string | null)?.trim() || null;
  const city        = (formData.get("city")        as string | null)?.trim() || null;
  const zipCode     = (formData.get("zip_code")    as string | null)?.trim() || null;
  const oethRaw     = formData.get("oeth_eligible") as string | null;
  const budgetRaw   = (formData.get("budget_annual") as string | null)?.trim() || "";
  const logoUrl     = (formData.get("logo_url")    as string | null)?.trim() || null;

  if (!name) {
    console.error("[updateCompanyAction] nom requis");
    return;
  }

  const oethEligible = oethRaw === "on" || oethRaw === "true";
  const budgetAnnual = budgetRaw ? Number(budgetRaw.replace(/\s/g, "").replace(",", ".")) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("companies")
    .update({
      name,
      siret,
      address,
      city,
      zip_code: zipCode,
      oeth_eligible: oethEligible,
      budget_annual: budgetAnnual,
      logo_url: logoUrl,
    })
    .eq("id", profile.company_id);

  if (error) {
    console.error("[updateCompanyAction] update failed:", error);
    return;
  }

  revalidatePath("/client/settings");
  revalidatePath("/client/dashboard");
  revalidatePath("/client/profile");
}
