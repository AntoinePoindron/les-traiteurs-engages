import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, ChefHat, CheckCircle, Clock } from "lucide-react";
import type { Caterer } from "@/types/database";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type CatFilter = "pending" | "validated";

const FILTER_TABS: { key: CatFilter; label: string }[] = [
  { key: "validated", label: "Validés" },
  { key: "pending",   label: "En attente" },
];

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminCaterersPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as CatFilter) ?? "validated";

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("caterers")
    .select("id, name, city, logo_url, esat_status, is_validated, specialties, created_at, description")
    .eq("is_validated", activeFilter === "validated")
    .order("created_at", { ascending: false });

  const caterers = (rows ?? []) as Caterer[];

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Traiteurs
          </h1>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={`/admin/caterers?filter=${key}`}
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
              {caterers.length} traiteur{caterers.length !== 1 ? "s" : ""}
            </p>

            {caterers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#6B7280]" style={mFont}>
                  {activeFilter === "pending"
                    ? "Aucun traiteur en attente de validation."
                    : "Aucun traiteur validé pour l'instant."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {caterers.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/admin/caterers/${cat.id}`}
                    className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                  >
                    {/* Logo / icône */}
                    {cat.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cat.logo_url} alt="" className="w-10 h-10 rounded-lg object-contain shrink-0" style={{ backgroundColor: "#F5F1E8" }} />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F5F1E8" }}
                      >
                        <ChefHat size={18} style={{ color: "#1A3A52" }} />
                      </div>
                    )}

                    {/* Contenu */}
                    <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-black" style={mFont}>{cat.name}</p>
                          {cat.esat_status && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                            >
                              ESAT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {cat.city && (
                            <p className="text-xs text-[#6B7280]" style={mFont}>{cat.city}</p>
                          )}
                          <p className="text-xs text-[#9CA3AF]" style={mFont}>
                            Inscrit le {new Date(cat.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {cat.is_validated ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#16A34A", ...mFont }}>
                            <CheckCircle size={12} />
                            Validé
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#B45309", ...mFont }}>
                            <Clock size={12} />
                            En attente
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
