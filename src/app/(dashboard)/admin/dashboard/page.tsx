import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckSquare, ChefHat, Building2, ShoppingBag, ChevronRight, Calendar, Users, LayoutGrid } from "lucide-react";
import { formatDateTime } from "@/lib/format";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_LABELS: Record<string, string> = {
  petit_dejeuner: "Petit déjeuner", pause_gourmande: "Pause gourmande",
  plateaux_repas: "Plateaux repas", cocktail_dinatoire: "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire", cocktail_aperitif: "Cocktail apéritif",
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name")
    .eq("id", user!.id)
    .single();
  const firstName = (profileData as { first_name: string | null } | null)?.first_name;

  // ── KPIs ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sq = supabase as any;

  const [
    { count: pendingQualif },
    { count: pendingCaterers },
    { count: activeCompanies },
    { count: ordersThisMonth },
  ] = await Promise.all([
    sq.from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("is_compare_mode", true)
      .eq("status", "pending_review"),
    supabase.from("caterers")
      .select("id", { count: "exact", head: true })
      .eq("is_validated", false),
    supabase.from("companies")
      .select("id", { count: "exact", head: true }),
    supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  // ── 5 dernières demandes à qualifier ─────────────────────────
  const { data: pendingRows } = await sq
    .from("quote_requests")
    .select(`
      id, title, event_date, guest_count,
      service_type, meal_type, created_at,
      companies ( name )
    `)
    .eq("is_compare_mode", true)
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingRequests: any[] = pendingRows ?? [];

  // ── Traiteurs en attente (5) ──────────────────────────────────
  const { data: pendingCatRows } = await supabase
    .from("caterers")
    .select("id, name, city, esat_status, created_at")
    .eq("is_validated", false)
    .order("created_at", { ascending: true })
    .limit(5);

  const pendingCaterersList = pendingCatRows ?? [];

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Bonjour{firstName ? `, ${firstName}` : ""} !
          </h1>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={CheckSquare}
              label="Demandes à qualifier"
              value={pendingQualif ?? 0}
              href="/admin/qualification"
              urgent={(pendingQualif ?? 0) > 0}
            />
            <KpiCard
              icon={ChefHat}
              label="Traiteurs en attente"
              value={pendingCaterers ?? 0}
              href="/admin/caterers"
              urgent={(pendingCaterers ?? 0) > 0}
            />
            <KpiCard
              icon={Building2}
              label="Clients"
              value={activeCompanies ?? 0}
            />
            <KpiCard
              icon={ShoppingBag}
              label="Commandes ce mois"
              value={ordersThisMonth ?? 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── File de qualification ── */}
            <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  File de qualification
                </p>
                <Link
                  href="/admin/qualification"
                  className="text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  Voir tout
                </Link>
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                  Aucune demande en attente.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#F3F4F6]">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {pendingRequests.map((req: any) => {
                    const eventDate = new Date(req.event_date).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                    });
                    const serviceLabel =
                      SERVICE_LABELS[req.service_type ?? ""] ||
                      SERVICE_LABELS[req.meal_type ?? ""] ||
                      req.service_type || req.meal_type || "—";

                    return (
                      <Link
                        key={req.id}
                        href={`/admin/qualification/${req.id}`}
                        className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "#F5F1E8" }}
                        >
                          <LayoutGrid size={18} style={{ color: "#1A3A52" }} />
                        </div>
                        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                              <p className="text-sm font-bold text-black truncate" style={mFont}>{serviceLabel}</p>
                              {req.companies?.name && (
                                <p className="text-xs text-[#9CA3AF] truncate shrink-0" style={mFont}>
                                  {req.companies.name}
                                </p>
                              )}
                              <span className="text-[10px] text-[#9CA3AF] shrink-0" style={mFont}>
                                Créée le {formatDateTime(req.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Calendar size={10} className="shrink-0" />
                                {eventDate}
                              </span>
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <Users size={10} className="shrink-0" />
                                {req.guest_count} convives
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Traiteurs en attente ── */}
            <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Traiteurs en attente
                </p>
                <Link
                  href="/admin/caterers?filter=pending"
                  className="text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  Voir tout
                </Link>
              </div>

              {pendingCaterersList.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                  Aucun traiteur en attente.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#F3F4F6]">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {pendingCaterersList.map((cat: any) => (
                    <Link
                      key={cat.id}
                      href={`/admin/caterers/${cat.id}`}
                      className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F5F1E8" }}
                      >
                        <ChefHat size={18} style={{ color: "#1A3A52" }} />
                      </div>
                      <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-bold text-black truncate" style={mFont}>{cat.name}</p>
                            {cat.esat_status && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                              >
                                ESAT
                              </span>
                            )}
                          </div>
                          {cat.city && (
                            <p className="text-xs text-[#6B7280]" style={mFont}>{cat.city}</p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

// ── KpiCard ────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  href,
  urgent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  href?: string;
  urgent?: boolean;
}) {
  const content = (
    <div className="bg-white rounded-lg p-5 flex flex-col gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          backgroundColor: urgent && value > 0 ? "#FFF3CD" : "#F5F1E8",
          color: urgent && value > 0 ? "#B45309" : "#1A3A52",
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p
          className="text-3xl font-display font-bold"
          style={{
            color: urgent && value > 0 ? "#B45309" : "#111827",
            fontVariationSettings: "'SOFT' 0, 'WONK' 1",
          }}
        >
          {value}
        </p>
        <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>{label}</p>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
