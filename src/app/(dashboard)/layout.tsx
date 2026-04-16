import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavWrapper from "@/components/layout/NavWrapper";
import NotificationCenter from "@/components/layout/NotificationCenter";
import type { UserRole } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("users")
    .select(`
      role,
      first_name,
      last_name,
      caterer_id,
      company_id,
      caterers ( name ),
      companies ( name )
    `)
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    first_name: string | null;
    last_name: string | null;
    caterer_id: string | null;
    company_id: string | null;
    caterers: { name: string } | null;
    companies: { name: string } | null;
  } | null;

  if (!profile) {
    redirect("/login");
  }

  const userName =
    profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : user.email ?? "";

  const catererName = profile.caterers?.name as string | undefined;
  const companyName = profile.companies?.name as string | undefined;

  return (
    <div className="flex min-h-screen bg-cream">
      <NavWrapper
        role={profile.role}
        catererName={catererName}
        companyName={companyName}
        userName={userName}
      />

      {/* pt-14 sur mobile pour compenser la topbar fixe */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {children}
      </div>

      <NotificationCenter />
    </div>
  );
}
