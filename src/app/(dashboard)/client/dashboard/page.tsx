import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import { Building2, FileText, ShoppingBag, Plus } from "lucide-react";
import Link from "next/link";

export default async function ClientDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, role, company_id, companies(name)")
    .eq("id", user!.id)
    .single();

  const profile = profileData as {
    first_name: string | null;
    role: string;
    company_id: string | null;
    companies: { name: string } | null;
  } | null;

  const companyName = profile?.companies?.name as string | undefined;

  return (
    <>
      <TopBar title="Tableau de bord" />

      <main className="flex-1 p-6 space-y-6">
        {/* Accroche */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-terracotta/10 flex items-center justify-center">
              <Building2 size={24} className="text-terracotta" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-dark">
                Bienvenue
                {profile?.first_name ? `, ${profile.first_name}` : ""} !
              </h2>
              {companyName && (
                <p className="text-sm text-gray-medium">{companyName}</p>
              )}
            </div>
          </div>

          <Link
            href="/client/requests/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-dark-terracotta transition-colors"
          >
            <Plus size={16} />
            Nouvelle demande
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={FileText} label="Demandes en cours" value="—" />
          <KpiCard icon={ShoppingBag} label="Commandes confirmées" value="—" />
          <KpiCard icon={Building2} label="Budget consommé" value="— €" />
        </div>

        {/* Placeholder dernières demandes */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold text-dark">
              Mes dernières demandes
            </h3>
            <Link
              href="/client/requests"
              className="text-sm text-terracotta hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <p className="text-sm text-gray-medium">
            Aucune demande pour le moment.{" "}
            <Link
              href="/client/requests/new"
              className="text-terracotta hover:underline"
            >
              Déposer une demande
            </Link>
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div className="w-10 h-10 rounded-lg bg-terracotta/10 flex items-center justify-center mb-3">
        <Icon size={20} className="text-terracotta" />
      </div>
      <p className="text-2xl font-display font-semibold text-dark">{value}</p>
      <p className="text-sm text-gray-medium mt-0.5">{label}</p>
    </div>
  );
}
