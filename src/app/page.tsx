import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";
import type { UserRole } from "@/types/database";

/**
 * Page racine :
 *  - Utilisateur connecté → redirigé vers son dashboard
 *  - Utilisateur non connecté → landing page marketing
 *
 * On conserve le redirect côté connecté pour que les users existants
 * ne voient pas la landing, qui est pensée pour l'acquisition.
 */
export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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
      // Si le user n'a pas de rôle (profile incomplet), on laisse
      // tomber sur la landing plutôt que de boucler.
    }
  }

  return <LandingPage />;
}
