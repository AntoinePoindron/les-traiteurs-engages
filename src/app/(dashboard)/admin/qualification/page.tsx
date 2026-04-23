import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { ChevronRight, Calendar, Users, MapPin, LayoutGrid } from "lucide-react";
import { dismissNotifications } from "@/lib/notifications";

// Never serve from cache: clients can edit their request at any time
// (address, guest count, etc.), which affects the qualification queue.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type QFilter = "pending" | "sent" | "cancelled";

const FILTER_TABS: { key: QFilter; label: string }[] = [
  { key: "pending",   label: "À qualifier" },
  { key: "sent",      label: "Envoyées" },
  { key: "cancelled", label: "Annulées" },
];

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminQualificationPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as QFilter) ?? "pending";

  const supabase = await createClient();

  // ── Dismissal contextuel ──
  // L'admin arrive sur la page qualification : on dégage les notifs
  // "nouveau traiteur à qualifier" et "nouvelle demande à qualifier".
  // Pas de scope entity (liste globale), on vide tout pour cet user.
  // Legacy : on inclut `caterer_pending_qualification` (ancien nom du
  // type avant renommage) pour nettoyer les notifs déjà en DB.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await dismissNotifications({
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      types: ["new_caterer_signup", "new_request_to_qualify", "caterer_pending_qualification" as any],
    });
  }

  const statusMap: Record<QFilter, string> = {
    pending:   "pending_review",
    sent:      "sent_to_caterers",
    cancelled: "cancelled",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, title, event_date, event_address, guest_count,
      service_type, meal_type, budget_global, budget_per_person,
      created_at, updated_at, status, super_admin_notes,
      companies ( name ),
      users!client_user_id ( first_name, last_name, email )
    `)
    .eq("is_compare_mode", true)
    .eq("status", statusMap[activeFilter])
    // Pour l'onglet "pending" : la plus ANCIENNE d'abord (logique
    // file d'attente qualif — on commence par celles qui attendent
    // depuis le plus longtemps). Les autres onglets : la plus
    // récemment mise à jour d'abord.
    .order(activeFilter === "pending" ? "created_at" : "updated_at", {
      ascending: activeFilter === "pending",
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = rows ?? [];

  const SERVICE_LABELS: Record<string, string> = {
    petit_dejeuner: "Petit déjeuner", pause_gourmande: "Pause gourmande",
    plateaux_repas: "Plateaux repas", cocktail_dinatoire: "Cocktail dinatoire",
    cocktail_dejeunatoire: "Cocktail déjeunatoire", cocktail_aperitif: "Cocktail apéritif",
    dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
  };

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            File de qualification
          </h1>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={`/admin/qualification?filter=${key}`}
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
              {requests.length} demande{requests.length !== 1 ? "s" : ""}
            </p>

            {requests.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#6B7280]" style={mFont}>
                  {activeFilter === "pending"
                    ? "Aucune demande en attente de qualification."
                    : "Aucune demande dans cette catégorie."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {requests.map((req: any) => {
                  const eventDate = new Date(req.event_date).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "short", year: "numeric",
                  });
                  const serviceLabel =
                    SERVICE_LABELS[req.service_type ?? ""] ||
                    SERVICE_LABELS[req.meal_type ?? ""] ||
                    req.service_type || req.meal_type || "—";
                  const user = req.users;
                  const contactName = user
                    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
                    : null;

                  return (
                    <Link
                      key={req.id}
                      href={`/admin/qualification/${req.id}`}
                      className="flex items-center gap-3 py-3.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                    >
                      {/* Icône */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F5F1E8" }}
                      >
                        <LayoutGrid size={18} style={{ color: "#1A3A52" }} />
                      </div>

                      {/* Contenu */}
                      <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <p className="text-sm font-bold text-black" style={mFont}>{serviceLabel}</p>
                            {req.companies?.name && (
                              <p className="text-xs text-[#9CA3AF] truncate" style={mFont}>
                                {req.companies.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                            <span className="text-xs text-[#6B7280]" style={mFont}>
                              {serviceLabel}
                            </span>
                            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                              <Calendar size={10} className="shrink-0" />
                              {eventDate}
                            </span>
                            <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                              <Users size={10} className="shrink-0" />
                              {req.guest_count} convives
                            </span>
                            {req.event_address && (
                              <span className="flex items-center gap-0.5 text-xs text-[#6B7280]" style={mFont}>
                                <MapPin size={10} className="shrink-0" />
                                {req.event_address.length > 35
                                  ? req.event_address.slice(0, 35) + "…"
                                  : req.event_address}
                              </span>
                            )}
                            {(req.budget_global || req.budget_per_person) && (
                              <span className="text-xs text-[#6B7280]" style={mFont}>
                                {req.budget_global
                                  ? `${Number(req.budget_global).toLocaleString("fr-FR")} €`
                                  : `${Number(req.budget_per_person).toLocaleString("fr-FR")} €/pers`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {activeFilter === "sent" && (
                            <StatusBadge variant="awaiting_quotes" customLabel="Envoyée" />
                          )}
                          {activeFilter === "cancelled" && (
                            <StatusBadge variant="cancelled" />
                          )}
                          {activeFilter === "pending" && (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold"
                              style={{ backgroundColor: "#FFF3CD", color: "#B45309", ...mFont }}
                            >
                              À qualifier
                            </span>
                          )}
                          <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
