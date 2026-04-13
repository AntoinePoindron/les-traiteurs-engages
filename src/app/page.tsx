import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

// Page racine : redirige vers le bon dashboard si connecté, sinon vers login
export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profileData as { role: UserRole } | null)?.role;

  switch (role) {
    case "caterer":
      redirect("/caterer/dashboard");
    case "client_admin":
    case "client_user":
      redirect("/client/dashboard");
    case "super_admin":
      redirect("/admin/dashboard");
    default:
      redirect("/login");
  }
}
