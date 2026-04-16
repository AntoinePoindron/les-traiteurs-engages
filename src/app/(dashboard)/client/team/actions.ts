"use server";

import { createClient } from "@/lib/supabase/server";
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
  const email      = (formData.get("email")      as string)?.trim() || null;
  const position   = (formData.get("position")   as string)?.trim() || null;
  const service_id = (formData.get("service_id") as string) || null;

  if (!first_name || !last_name) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("company_employees").insert({
    company_id: companyId, first_name, last_name, email, position,
    service_id: service_id || null,
  });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("company_employees").delete().eq("id", employee_id);
  revalidatePath("/client/team");
  redirect("/client/team?tab=effectifs");
}
