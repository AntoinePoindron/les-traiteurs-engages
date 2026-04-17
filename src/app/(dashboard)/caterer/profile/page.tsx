import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/caterer/ProfileForm";
import PendingQualificationBanner from "@/components/caterer/PendingQualificationBanner";
import type { Caterer } from "@/types/database";

export default async function CatererProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user!.id)
    .single();

  const catererId = (profileData as { caterer_id: string | null } | null)
    ?.caterer_id;

  const { data: catererData } = await supabase
    .from("caterers")
    .select("*")
    .eq("id", catererId ?? "")
    .single();

  const caterer = catererData as Caterer | null;

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>
          {caterer && !caterer.is_validated && <PendingQualificationBanner />}
          {caterer ? (
            <ProfileForm caterer={caterer} catererId={catererId!} />
          ) : (
            <p
              className="text-sm text-center py-12"
              style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#6B7280" }}
            >
              Impossible de charger votre fiche traiteur.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
