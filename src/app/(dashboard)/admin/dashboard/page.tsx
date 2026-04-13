import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { CheckSquare, ChefHat, Building2, ShoppingBag } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  return (
    <>
      <TopBar title="Administration" />

      <main className="flex-1 p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KpiCard
            icon={CheckSquare}
            label="Demandes à qualifier"
            value="—"
            color="coral-red"
          />
          <KpiCard
            icon={ChefHat}
            label="Traiteurs en attente"
            value="—"
            color="terracotta"
          />
          <KpiCard
            icon={Building2}
            label="Entreprises actives"
            value="—"
            color="olive"
          />
          <KpiCard
            icon={ShoppingBag}
            label="Commandes ce mois"
            value="—"
            color="dark-terracotta"
          />
        </div>

        {/* File de qualification */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="font-display text-base font-semibold text-dark mb-4">
            File de qualification
          </h3>
          <p className="text-sm text-gray-medium">
            Aucune demande en attente de qualification.
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
    "coral-red": "bg-coral-red/10 text-coral-red",
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
