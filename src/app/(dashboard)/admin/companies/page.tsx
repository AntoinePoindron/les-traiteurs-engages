import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, Building2, FileText, ShoppingBag, Users } from "lucide-react";
import type { Company } from "@/types/database";

// Never serve from cache: clients add requests and users continuously.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type CompanyFilter = "all" | "active" | "inactive";

const FILTER_TABS: { key: CompanyFilter; label: string }[] = [
  { key: "all",      label: "Toutes" },
  { key: "active",   label: "Actives" },
  { key: "inactive", label: "Sans activité" },
];

const ACTIVE_STATUSES = ["pending_review", "approved", "sent_to_caterers"];

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

type CompanyRow = Company & {
  users: { id: string }[] | null;
  quote_requests: { id: string; status: string }[] | null;
};

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as CompanyFilter) ?? "all";

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("companies")
    .select(`
      id, name, city, logo_url, oeth_eligible, siret, created_at,
      users ( id ),
      quote_requests ( id, status )
    `)
    .order("created_at", { ascending: false });

  const companies = (rows ?? []) as CompanyRow[];

  // Enrich with counts
  const enriched = companies.map((c) => {
    const userCount = c.users?.length ?? 0;
    const requests = c.quote_requests ?? [];
    const activeRequestCount = requests.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
    const totalRequestCount = requests.length;
    const hasActivity = totalRequestCount > 0 || userCount > 0;
    return {
      ...c,
      userCount,
      activeRequestCount,
      totalRequestCount,
      hasActivity,
    };
  });

  // Apply filter
  const filtered = enriched.filter((c) => {
    if (activeFilter === "active")   return c.activeRequestCount > 0;
    if (activeFilter === "inactive") return !c.hasActivity;
    return true;
  });

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Clients
          </h1>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={`/admin/companies?filter=${key}`}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isActive ? "#1A3A52" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#6B7280",
                    ...mFont,
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Liste */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-6">
            <p className="text-xs font-bold text-black" style={mFont}>
              {filtered.length} client{filtered.length !== 1 ? "s" : ""}
            </p>

            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#6B7280]" style={mFont}>
                  {activeFilter === "active"
                    ? "Aucun client avec une activité en cours."
                    : activeFilter === "inactive"
                      ? "Tous les clients ont au moins un utilisateur ou une demande."
                      : "Aucun client enregistré."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {filtered.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/companies/${c.id}`}
                    className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                  >
                    {/* Logo / icône */}
                    {c.logo_url ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white flex items-center justify-center border border-[#F3F4F6]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F5F1E8" }}
                      >
                        <Building2 size={18} style={{ color: "#1A3A52" }} />
                      </div>
                    )}

                    {/* Contenu */}
                    <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-black truncate" style={mFont}>{c.name}</p>
                          {c.oeth_eligible && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                            >
                              OETH
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5">
                          {c.city && (
                            <p className="text-xs text-[#6B7280]" style={mFont}>{c.city}</p>
                          )}
                          <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                            <Users size={10} />
                            {c.userCount}
                          </span>
                          <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                            <FileText size={10} />
                            {c.totalRequestCount}
                          </span>
                          <p className="text-xs text-[#9CA3AF]" style={mFont}>
                            Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {c.activeRequestCount > 0 ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#0284C7", ...mFont }}>
                            <ShoppingBag size={12} />
                            {c.activeRequestCount} en cours
                          </span>
                        ) : c.totalRequestCount > 0 ? (
                          <span className="text-[10px] font-bold" style={{ color: "#6B7280", ...mFont }}>
                            Historique
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold" style={{ color: "#9CA3AF", ...mFont }}>
                            Pas d&apos;activité
                          </span>
                        )}
                        <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
