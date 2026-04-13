import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { ChefHat, FileText, ShoppingBag, TrendingUp } from "lucide-react";

export default async function CatererDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, caterer_id")
    .eq("id", user!.id)
    .single();

  const profile = profileData as { first_name: string | null; caterer_id: string | null } | null;

  const catererName = profile?.caterer_id
    ? await supabase
        .from("caterers")
        .select("name")
        .eq("id", profile.caterer_id)
        .single()
        .then((r) => (r.data as { name: string } | null)?.name)
    : null;

  return (
    <>
      <TopBar title="Tableau de bord" />

      <main className="flex-1 p-6 space-y-6">
        {/* Accroche */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center">
              <ChefHat size={24} className="text-terracotta" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-dark">
                Bienvenue
                {profile?.first_name ? `, ${profile.first_name}` : ""} !
              </h2>
              {catererName && (
                <p className="text-sm text-gray-medium">{catererName}</p>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            icon={FileText}
            label="Nouvelles demandes"
            value="—"
            color="terracotta"
          />
          <KpiCard
            icon={ShoppingBag}
            label="Commandes en cours"
            value="—"
            color="olive"
          />
          <KpiCard
            icon={TrendingUp}
            label="CA ce mois"
            value="— €"
            color="dark-terracotta"
          />
        </div>

        {/* Placeholder activité récente */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="font-display text-base font-semibold text-dark mb-4">
            Activité récente
          </h3>
          <p className="text-sm text-gray-medium">
            Aucune activité récente pour le moment.
          </p>
        </div>
      </main>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    terracotta: "bg-terracotta/10 text-terracotta",
    olive: "bg-olive/10 text-olive",
    "dark-terracotta": "bg-dark-terracotta/10 text-dark-terracotta",
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorMap[color] ?? "bg-gray-light text-dark"}`}
      >
        <Icon size={20} />
      </div>
      <p className="text-2xl font-display font-semibold text-dark">{value}</p>
      <p className="text-sm text-gray-medium mt-0.5">{label}</p>
    </div>
  );
}
