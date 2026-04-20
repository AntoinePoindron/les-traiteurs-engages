"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type DevUser = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  entity_name: string | null;
  is_active: boolean;
};

export async function listDevUsers(): Promise<DevUser[]> {
  if (process.env.NODE_ENV !== "development") return [];

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("users")
    .select(`
      id,
      email,
      role,
      first_name,
      last_name,
      is_active,
      caterers ( name ),
      companies ( name )
    `)
    .order("role", { ascending: true })
    .order("first_name", { ascending: true });

  if (error || !data) {
    console.error("[listDevUsers]", error);
    return [];
  }

  return (data as Array<{
    id: string;
    email: string;
    role: UserRole;
    first_name: string | null;
    last_name: string | null;
    is_active: boolean;
    caterers: { name: string } | null;
    companies: { name: string } | null;
  }>).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    first_name: u.first_name,
    last_name: u.last_name,
    is_active: u.is_active,
    entity_name: u.caterers?.name ?? u.companies?.name ?? null,
  }));
}

/**
 * Définit le même mot de passe pour TOUS les users de la base.
 * Destiné au développement uniquement — no-op en prod.
 * Renvoie le nombre d'utilisateurs mis à jour et la liste des échecs éventuels.
 */
export async function setPasswordForAllDevUsers(
  newPassword: string
): Promise<{ updated: number; failed: { email: string; error: string }[] }> {
  if (process.env.NODE_ENV !== "development") {
    return { updated: 0, failed: [] };
  }

  if (!newPassword || newPassword.length < 6) {
    return {
      updated: 0,
      failed: [{ email: "—", error: "Mot de passe trop court (minimum 6 caractères)." }],
    };
  }

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("users")
    .select("id, email");

  if (error || !data) {
    console.error("[setPasswordForAllDevUsers] list failed:", error);
    return { updated: 0, failed: [{ email: "—", error: error?.message ?? "Liste inaccessible" }] };
  }

  const users = data as Array<{ id: string; email: string }>;

  let updated = 0;
  const failed: { email: string; error: string }[] = [];

  for (const u of users) {
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
      password: newPassword,
    });
    if (upErr) {
      failed.push({ email: u.email, error: upErr.message });
    } else {
      updated++;
    }
  }

  return { updated, failed };
}
