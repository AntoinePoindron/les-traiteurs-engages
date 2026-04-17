"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Helper ─────────────────────────────────────────────────────

async function getCompanyId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single();
  return (profile as { company_id: string | null } | null)?.company_id ?? null;
}

/**
 * Vérifie si un compte plateforme existe déjà avec cet email.
 * Utilise le service-role pour passer outre la RLS users_select.
 * Sert à empêcher l'invitation d'un email déjà inscrit.
 */
export async function checkEmailHasAccount(email: string): Promise<boolean> {
  const cleaned = (email ?? "").trim().toLowerCase();
  if (!cleaned) return false;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("users")
    .select("id")
    .ilike("email", cleaned)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// ── Services ───────────────────────────────────────────────────

export async function createServiceAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const rawBudget = formData.get("annual_budget") as string;
  const annual_budget = rawBudget ? parseFloat(rawBudget.replace(/\s/g, "").replace(",", ".")) : 0;

  if (!name) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("company_services").insert({
    company_id: companyId, name, description, annual_budget,
  });
  revalidatePath("/client/team");
  redirect("/client/team?tab=services");
}

export async function deleteServiceAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const serviceId = formData.get("service_id") as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("company_services").delete().eq("id", serviceId);
  revalidatePath("/client/team");
  redirect("/client/team?tab=services");
}

// ── Employees ──────────────────────────────────────────────────

export async function createEmployeeAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const first_name = (formData.get("first_name") as string)?.trim();
  const last_name  = (formData.get("last_name")  as string)?.trim();
  const email      = (formData.get("email")      as string)?.trim().toLowerCase() || null;
  const position   = (formData.get("position")   as string)?.trim() || null;
  const service_id = (formData.get("service_id") as string) || null;

  if (!first_name || !last_name) return;

  // Refus si l'email est déjà associé à un compte plateforme
  // (l'admin doit lui demander une demande d'adhésion classique).
  if (email && (await checkEmailHasAccount(email))) {
    console.error("[createEmployeeAction] email déjà utilisé par un compte:", email);
    redirect("/client/team?tab=effectifs&error=email_exists");
  }

  // Insert company_employees. Si un email est saisi, on marque
  // invited_at tout de suite (le badge "En attente de réponse"
  // apparaît immédiatement). L'envoi d'email est géré côté UI via
  // le bouton "Copier l'invitation".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any)
    .from("company_employees")
    .insert({
      company_id: companyId,
      first_name,
      last_name,
      email,
      position,
      service_id: service_id || null,
      invited_at: email ? new Date().toISOString() : null,
    });

  if (insertErr) {
    console.error("[createEmployeeAction] insert failed:", insertErr);
    return;
  }

  // L'invitation par email est gérée côté UI (mailto: dans le bouton
  // "Renvoyer l'invitation" + lien /signup pré-rempli), ou plus tard
  // via un SMTP custom configuré dans Supabase. Le rattachement
  // automatique se fait via le trigger SQL handle_new_user dès que
  // l'invité s'inscrira avec le même email.

  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}

export async function updateEmployeeAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const employee_id = formData.get("employee_id") as string;
  const first_name  = (formData.get("first_name") as string)?.trim();
  const last_name   = (formData.get("last_name")  as string)?.trim();
  const email       = (formData.get("email")      as string)?.trim() || null;
  const position    = (formData.get("position")   as string)?.trim() || null;
  const service_id  = (formData.get("service_id") as string) || null;

  if (!employee_id || !first_name || !last_name) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("company_employees")
    .update({ first_name, last_name, email, position, service_id: service_id || null })
    .eq("id", employee_id)
    .eq("company_id", companyId);

  if (error) {
    console.error("[updateEmployeeAction] update failed:", error);
    return;
  }

  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}

export async function updateEmployeeServiceAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const employee_id = formData.get("employee_id") as string;
  const service_id  = (formData.get("service_id") as string) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("company_employees")
    .update({ service_id: service_id || null })
    .eq("id", employee_id);
  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}

export async function deleteEmployeeAction(formData: FormData) {
  const supabase = await createClient();
  const companyId = await getCompanyId();
  if (!companyId) return;

  const employee_id = formData.get("employee_id") as string;
  if (!employee_id) return;

  // Sécurité : seul un admin actif de la company peut supprimer
  if (!(await assertAdminOfCompany(companyId))) {
    console.error("[deleteEmployeeAction] non autorisé");
    return;
  }

  // ID de l'utilisateur courant (pour éviter qu'un admin se supprime lui-même
  // par mégarde — il doit garder son accès admin).
  const { data: { user: caller } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // Récupère le user_id éventuel lié à cet effectif (compte plateforme)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: empRow } = await (admin as any)
    .from("company_employees")
    .select("id, user_id, company_id, email")
    .eq("id", employee_id)
    .eq("company_id", companyId)
    .single();

  if (!empRow) {
    console.error("[deleteEmployeeAction] effectif introuvable", { employee_id });
    return;
  }

  const linkedUserId: string | null = empRow.user_id ?? null;

  // Garde-fou : on n'autorise pas l'auto-suppression
  if (linkedUserId && caller && linkedUserId === caller.id) {
    console.error("[deleteEmployeeAction] l'admin tente de se supprimer lui-même");
    return;
  }

  // Si un compte plateforme est lié → supprimer l'auth user
  // (la FK users.id → auth.users(id) ON DELETE CASCADE supprime la ligne users.
  // La FK company_employees.user_id ON DELETE SET NULL met user_id à null.
  // Les sessions du user concerné deviennent invalides.)
  if (linkedUserId) {
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(linkedUserId);
    if (deleteAuthErr) {
      console.error("[deleteEmployeeAction] delete auth user failed:", deleteAuthErr);
      // On continue quand même pour supprimer l'effectif
    }
  }

  // Supprime la ligne d'effectif
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: empDelErr } = await (admin as any)
    .from("company_employees")
    .delete()
    .eq("id", employee_id)
    .eq("company_id", companyId);

  if (empDelErr) {
    console.error("[deleteEmployeeAction] delete employee failed:", empDelErr);
  }

  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}

// ── Membership requests (validation des adhésions) ───────────────

/**
 * Helper : vérifie que le caller est admin actif de la company indiquée.
 * On utilise la session du caller (RLS standard), sa lecture de son propre
 * profil est autorisée.
 */
async function assertAdminOfCompany(companyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("users")
    .select("role, company_id, membership_status")
    .eq("id", user.id)
    .single();
  const p = profile as { role: string; company_id: string | null; membership_status: string } | null;
  return Boolean(
    p &&
    p.role === "client_admin" &&
    p.membership_status === "active" &&
    p.company_id === companyId
  );
}

export async function approveMembershipAction(formData: FormData) {
  const companyId = await getCompanyId();
  if (!companyId) {
    console.error("[approveMembershipAction] companyId introuvable");
    return;
  }

  const userId = formData.get("user_id") as string;
  if (!userId) {
    console.error("[approveMembershipAction] user_id manquant");
    return;
  }

  if (!(await assertAdminOfCompany(companyId))) {
    console.error("[approveMembershipAction] non autorisé");
    return;
  }

  // RLS users_update n'autorise que self-update → on passe par le service-role
  // après avoir vérifié manuellement l'ownership ci-dessus.
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin as any)
    .from("users")
    .update({ membership_status: "active" })
    .eq("id", userId)
    .eq("company_id", companyId)
    .eq("membership_status", "pending")
    .select("id, first_name, last_name, email");

  if (error) {
    console.error("[approveMembershipAction] update failed:", error);
    return;
  }
  if (!updated || updated.length === 0) {
    console.error("[approveMembershipAction] aucune ligne mise à jour", { userId, companyId });
    return;
  }

  // Ajouter automatiquement le user à la liste des effectifs
  // (company_employees est une table distincte de users — il faut donc
  // créer une ligne pour qu'il apparaisse dans l'onglet Effectifs).
  // On évite le doublon si un effectif avec le même email existe déjà.
  const userInfo = updated[0] as {
    id: string;
    first_name: string | null;
    last_name:  string | null;
    email:      string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingEmp } = await (admin as any)
    .from("company_employees")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", userInfo.email)
    .maybeSingle();

  // ID de l'effectif à ouvrir dans la modale après redirect
  let employeeIdToEdit: string | null = existingEmp?.id ?? null;

  if (!existingEmp) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdEmp, error: empErr } = await (admin as any)
      .from("company_employees")
      .insert({
        company_id: companyId,
        first_name: userInfo.first_name ?? userInfo.email.split("@")[0],
        last_name:  userInfo.last_name  ?? "",
        email:      userInfo.email,
      })
      .select("id")
      .single();
    if (empErr) {
      console.error("[approveMembershipAction] insert employee failed:", empErr);
      // non bloquant — l'admin pourra ajouter manuellement
    } else {
      employeeIdToEdit = createdEmp?.id ?? null;
    }
  }

  // Notifier l'utilisateur dont l'adhésion vient d'être validée
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("notifications").insert({
    user_id:             userId,
    type:                "collaborator_approved",
    title:               "Votre adhésion a été validée",
    body:                "Vous pouvez maintenant accéder à votre espace.",
    related_entity_type: "user",
    related_entity_id:   userId,
  });

  revalidatePath("/client/team");
  // On ouvre directement la modale d'édition pour configurer poste / service
  const target = employeeIdToEdit
    ? `/client/team?tab=effectifs&edit=${employeeIdToEdit}`
    : "/client/team?tab=effectifs";
  redirect(target);
}

export async function rejectMembershipAction(formData: FormData) {
  const companyId = await getCompanyId();
  if (!companyId) {
    console.error("[rejectMembershipAction] companyId introuvable");
    return;
  }

  const userId = formData.get("user_id") as string;
  if (!userId) {
    console.error("[rejectMembershipAction] user_id manquant");
    return;
  }

  if (!(await assertAdminOfCompany(companyId))) {
    console.error("[rejectMembershipAction] non autorisé");
    return;
  }

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin as any)
    .from("users")
    .update({ membership_status: "rejected" })
    .eq("id", userId)
    .eq("company_id", companyId)
    .eq("membership_status", "pending")
    .select("id");

  if (error) {
    console.error("[rejectMembershipAction] update failed:", error);
    return;
  }
  if (!updated || updated.length === 0) {
    console.error("[rejectMembershipAction] aucune ligne mise à jour", { userId, companyId });
    return;
  }

  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}
