import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2, Users, Euro, Plus, Trash2,
  BarChart3,
} from "lucide-react";
import type { CompanyService, CompanyEmployee } from "@/types/database";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  approveMembershipAction,
  rejectMembershipAction,
} from "./actions";
import EmployeeModal from "@/components/client/EmployeeModal";
import ServiceModal from "@/components/client/ServiceModal";
import CopyInviteLinkButton from "@/components/client/CopyInviteLinkButton";
import { CheckCircle, XCircle } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type Tab = "services" | "effectifs" | "depenses";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    action?: string;
    service?: string;
    edit?: string;
    error?: string;
  }>;
}

// ── Page ───────────────────────────────────────────────────────

export default async function ClientTeamPage({ searchParams }: PageProps) {
  const { tab, action, edit: editEmployeeId, error: pageError } = await searchParams;
  const activeTab: Tab = (tab as Tab) || "services";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user!.id;

  const { data: profile } = await supabase
    .from("users").select("company_id, role").eq("id", user!.id).single();
  const companyId = (profile as { company_id: string | null; role: string } | null)?.company_id ?? null;

  // ── Fetch services ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: servicesRaw } = await (supabase as any)
    .from("company_services")
    .select("id, name, description, annual_budget, created_at")
    .eq("company_id", companyId ?? "")
    .order("name");

  const services: CompanyService[] = servicesRaw ?? [];

  // ── Fetch employees ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employeesRaw } = await (supabase as any)
    .from("company_employees")
    .select("id, first_name, last_name, email, position, service_id, created_at, invited_at, user_id")
    .eq("company_id", companyId ?? "")
    .order("last_name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees: (CompanyEmployee & { invited_at: string | null; user_id: string | null })[] =
    employeesRaw ?? [];

  // ── Fetch demandes d'adhésion en attente ────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingMembersRaw } = await (supabase as any)
    .from("users")
    .select("id, first_name, last_name, email, created_at")
    .eq("company_id", companyId ?? "")
    .eq("membership_status", "pending")
    .order("created_at", { ascending: false });

  const pendingMembers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    created_at: string;
  }[] = pendingMembersRaw ?? [];

  // ── Fetch dépenses par service ───────────────────────────────
  // orders → quotes → quote_requests.company_service_id → company_services
  // On récupère TOUTES les commandes de la company (peu importe quel
  // membre les a passées), pas seulement celles de l'admin connecté.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersForExpenses } = await (supabase as any)
    .from("orders")
    .select(`
      quotes!inner (
        total_amount_ht,
        quote_requests!inner (
          company_id,
          company_service_id
        )
      )
    `)
    .eq("quotes.quote_requests.company_id", companyId ?? "")
    .in("status", ["confirmed", "delivered", "invoiced", "paid"]);

  // Agrégation des dépenses par service
  const spendByService: Record<string, number> = {};
  for (const order of ordersForExpenses ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sid = (order as any).quotes?.quote_requests?.company_service_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const amount = Number((order as any).quotes?.total_amount_ht ?? 0);
    if (sid) {
      spendByService[sid] = (spendByService[sid] ?? 0) + amount;
    }
  }

  const totalSpent = Object.values(spendByService).reduce((s, v) => s + v, 0);
  const totalBudget = services.reduce((s, sv) => s + (sv.annual_budget ?? 0), 0);

  // Comptage effectifs par service
  const countByService: Record<string, number> = {};
  for (const emp of employees) {
    if (emp.service_id) {
      countByService[emp.service_id] = (countByService[emp.service_id] ?? 0) + 1;
    }
  }

  // Service map pour les selects
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Équipe & services
          </h1>

          {/* KPIs rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MiniKpi icon={Building2} label="Services" value={String(services.length)} />
            <MiniKpi icon={Users}     label="Effectifs" value={String(employees.length)} />
            <MiniKpi icon={Euro}      label="Budget annuel" value={totalBudget > 0 ? totalBudget.toLocaleString("fr-FR") + " €" : "—"} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "services",  label: "Services",         icon: Building2 },
              { key: "effectifs", label: "Effectifs",        icon: Users },
              { key: "depenses",  label: "Dépenses",         icon: BarChart3 },
            ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <Link
                  key={key}
                  href={`/client/team?tab=${key}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all"
                  style={{
                    backgroundColor: isActive ? "#1A3A52" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#6B7280",
                    ...mFont,
                  }}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* ── TAB : SERVICES ── */}
          {activeTab === "services" && (
            <div className="flex flex-col gap-4">

              {/* Bouton "Nouveau service" → ouvre la modale */}
              <div className="flex justify-end">
                <ServiceModal
                  action={createServiceAction}
                  defaultOpen={action === "add-service"}
                />
              </div>

              {/* Liste des services */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-0">
                {services.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center gap-2">
                    <Building2 size={32} className="text-[#D1D5DB]" />
                    <p className="text-sm text-[#6B7280]" style={mFont}>Aucun service créé.</p>
                    <Link
                      href="/client/team?tab=services&action=add-service"
                      className="text-sm font-bold text-[#1A3A52] underline underline-offset-2 hover:opacity-70"
                      style={mFont}
                    >
                      Créer le premier service
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {services.map((service) => {
                      const spent = spendByService[service.id] ?? 0;
                      const budget = service.annual_budget ?? 0;
                      const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                      const headcount = countByService[service.id] ?? 0;

                      return (
                        <div key={service.id} className="py-4 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-black" style={mFont}>{service.name}</p>
                              {service.description && (
                                <p className="text-xs text-[#9CA3AF] mt-0.5" style={mFont}>{service.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <ServiceModal
                                mode="edit"
                                action={updateServiceAction}
                                service={{
                                  id: service.id,
                                  name: service.name,
                                  description: service.description,
                                  annual_budget: service.annual_budget ?? 0,
                                }}
                              />
                              <form action={deleteServiceAction}>
                                <input type="hidden" name="service_id" value={service.id} />
                                <button
                                  type="submit"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                                  title="Supprimer ce service"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </form>
                            </div>
                          </div>

                          {/* Méta */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-[#6B7280]" style={mFont}>
                              <Users size={11} />
                              {headcount} effectif{headcount !== 1 ? "s" : ""}
                            </span>
                            {budget > 0 && (
                              <span className="flex items-center gap-1 text-xs text-[#6B7280]" style={mFont}>
                                <Euro size={11} />
                                Budget : {budget.toLocaleString("fr-FR")} €
                              </span>
                            )}
                            {spent > 0 && (
                              <span className="flex items-center gap-1 text-xs text-[#6B7280]" style={mFont}>
                                Dépensé : {spent.toLocaleString("fr-FR")} €
                              </span>
                            )}
                          </div>

                          {/* Barre de progression budget */}
                          {budget > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct > 90 ? "#DC2626" : pct > 70 ? "#F59E0B" : "#1A3A52",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-[#9CA3AF] shrink-0" style={mFont}>{Math.round(pct)} %</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB : EFFECTIFS ── */}
          {activeTab === "effectifs" && (
            <div className="flex flex-col gap-4">

              {/* Bandeau d'erreur (échec d'invitation) */}
              {pageError === "email_exists" && (
                <div
                  className="bg-white rounded-lg px-4 py-3 border-l-4"
                  style={{ borderLeftColor: "#DC2626" }}
                >
                  <p className="text-xs font-bold text-[#DC2626]" style={mFont}>
                    Cet email est déjà associé à un compte existant — invitation impossible.
                  </p>
                </div>
              )}

              {/* Bandeau demandes d'adhésion en attente (compact) */}
              {pendingMembers.length > 0 && (
                <div
                  className="bg-white rounded-lg px-4 py-3 flex flex-col gap-1.5 border-l-4"
                  style={{ borderLeftColor: "#F59E0B" }}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-black" style={mFont}>
                      Demandes d&apos;adhésion
                    </p>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#FEF3C7", color: "#B45309", ...mFont }}
                    >
                      {pendingMembers.length}
                    </span>
                  </div>

                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {pendingMembers.map((member) => {
                      const fullName = [member.first_name, member.last_name]
                        .filter(Boolean)
                        .join(" ") || member.email;
                      const initials =
                        ((member.first_name?.[0] ?? "") + (member.last_name?.[0] ?? "")).toUpperCase() ||
                        member.email[0].toUpperCase();
                      const askedAt = new Date(member.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short",
                      });
                      return (
                        <div key={member.id} className="py-2 flex items-center gap-3">
                          {/* Avatar */}
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: "#F59E0B", ...mFont }}
                          >
                            {initials}
                          </div>

                          {/* Infos sur une ligne */}
                          <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-bold text-black truncate" style={mFont}>
                              {fullName}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] truncate" style={mFont}>
                              {member.email} · {askedAt}
                            </span>
                          </div>

                          {/* Actions */}
                          <form action={approveMembershipAction} className="shrink-0">
                            <input type="hidden" name="user_id" value={member.id} />
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white hover:opacity-90 transition-opacity"
                              style={{ backgroundColor: "#16A34A", ...mFont }}
                              title="Valider l'adhésion"
                            >
                              <CheckCircle size={11} />
                              Valider
                            </button>
                          </form>
                          <form action={rejectMembershipAction} className="shrink-0">
                            <input type="hidden" name="user_id" value={member.id} />
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#DC2626] border border-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                              style={mFont}
                              title="Refuser l'adhésion"
                            >
                              <XCircle size={11} />
                              Refuser
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bouton "Ajouter" → ouvre la modale */}
              <div className="flex justify-end">
                <EmployeeModal
                  mode="add"
                  services={services.map((s) => ({ id: s.id, name: s.name }))}
                  action={createEmployeeAction}
                />
              </div>

              {/* Liste des effectifs groupés par service */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                {employees.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center gap-2">
                    <Users size={32} className="text-[#D1D5DB]" />
                    <p className="text-sm text-[#6B7280]" style={mFont}>Aucun collaborateur renseigné.</p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {employees.map((emp) => {
                      const isPending = Boolean(emp.invited_at) && !emp.user_id;
                      const isSelf = emp.user_id === currentUserId;
                      return (
                      <div key={emp.id} className="py-4 flex items-center gap-4">
                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: isPending ? "#9CA3AF" : "#1A3A52", ...mFont }}
                        >
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-black" style={mFont}>
                              {emp.first_name} {emp.last_name}
                            </p>
                            {isPending && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: "#FEF3C7", color: "#B45309", ...mFont }}
                                title="L'invitation a été envoyée — en attente de création du compte"
                              >
                                En attente de réponse
                              </span>
                            )}
                            {isSelf && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: "#E0F2FE", color: "#075985", ...mFont }}
                                title="C'est votre ligne"
                              >
                                Vous
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {emp.position && (
                              <span className="text-xs text-[#6B7280]" style={mFont}>{emp.position}</span>
                            )}
                            {emp.email && (
                              <span className="text-xs text-[#9CA3AF]" style={mFont}>{emp.email}</span>
                            )}
                          </div>
                        </div>

                        {/* Bouton "Copier l'invitation" (uniquement si en attente) */}
                        {isPending && emp.email && (
                          <CopyInviteLinkButton email={emp.email} />
                        )}

                        {/* Badge service (lecture) */}
                        <span
                          className="text-xs text-[#1A3A52] px-2 py-1 rounded-full shrink-0 max-w-[140px] truncate"
                          style={{ backgroundColor: "#F0F4F7", ...mFont }}
                          title={emp.service_id ? serviceMap[emp.service_id] ?? "Service inconnu" : "Non assigné"}
                        >
                          {emp.service_id ? serviceMap[emp.service_id] ?? "Service inconnu" : "Non assigné"}
                        </span>

                        {/* Modifier (modale) */}
                        <EmployeeModal
                          mode="edit"
                          services={services.map((s) => ({ id: s.id, name: s.name }))}
                          action={updateEmployeeAction}
                          defaultOpen={editEmployeeId === emp.id}
                          employee={{
                            id: emp.id,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            email: emp.email,
                            position: emp.position,
                            service_id: emp.service_id,
                          }}
                        />


                        {/* Supprimer — masqué pour sa propre ligne (voir aussi garde-fou dans l'action serveur) */}
                        {!isSelf ? (
                          <form action={deleteEmployeeAction}>
                            <input type="hidden" name="employee_id" value={emp.id} />
                            <button
                              type="submit"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-[#FEF2F2] transition-colors shrink-0"
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </form>
                        ) : (
                          <span className="w-7 h-7 shrink-0" aria-hidden />
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB : DÉPENSES ── */}
          {activeTab === "depenses" && (
            <div className="flex flex-col gap-4">

              {/* Résumé global */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-5 flex flex-col gap-2">
                  <p className="text-xs text-[#6B7280]" style={mFont}>Budget annuel total</p>
                  <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    {totalBudget > 0 ? totalBudget.toLocaleString("fr-FR") + " €" : "—"}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-5 flex flex-col gap-2">
                  <p className="text-xs text-[#6B7280]" style={mFont}>Total dépensé (commandes)</p>
                  <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    {totalSpent > 0 ? totalSpent.toLocaleString("fr-FR") + " €" : "—"}
                  </p>
                  {totalBudget > 0 && totalSpent > 0 && (
                    <p className="text-xs text-[#9CA3AF]" style={mFont}>
                      {Math.round((totalSpent / totalBudget) * 100)} % du budget consommé
                    </p>
                  )}
                </div>
              </div>

              {/* Détail par service */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Dépenses par service
                </p>

                {services.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#6B7280]" style={mFont}>
                      Créez des services pour suivre les dépenses par département.
                    </p>
                    <Link
                      href="/client/team?tab=services&action=add-service"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#1A3A52] underline underline-offset-2 hover:opacity-70"
                      style={mFont}
                    >
                      <Plus size={13} />
                      Créer un service
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Sans service */}
                    {(() => {
                      const unassigned = (ordersForExpenses ?? []).filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (o: any) => !o.quotes?.quote_requests?.company_service_id
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ).reduce((sum: number, o: any) => sum + Number(o.quotes?.total_amount_ht ?? 0), 0);
                      if (unassigned === 0) return null;
                      return (
                        <ExpenseRow
                          name="Sans service"
                          spent={unassigned}
                          budget={null}
                          headcount={null}
                          mFont={mFont}
                        />
                      );
                    })()}

                    {/* Par service */}
                    {services
                      .sort((a, b) => (spendByService[b.id] ?? 0) - (spendByService[a.id] ?? 0))
                      .map((service) => (
                        <ExpenseRow
                          key={service.id}
                          name={service.name}
                          spent={spendByService[service.id] ?? 0}
                          budget={service.annual_budget ?? null}
                          headcount={countByService[service.id] ?? 0}
                          mFont={mFont}
                        />
                      ))}
                  </div>
                )}

                {services.length > 0 && Object.keys(spendByService).length === 0 && (
                  <p className="text-xs text-[#9CA3AF] text-center py-4" style={mFont}>
                    Associez des demandes de devis à vos services pour voir les dépenses apparaître ici.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function MiniKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-lg p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#F0F4F7" }}>
        <Icon size={17} style={{ color: "#1A3A52" }} />
      </div>
      <div>
        <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
          {value}
        </p>
        <p className="text-[11px] text-[#6B7280]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>{label}</p>
      </div>
    </div>
  );
}

function ExpenseRow({
  name, spent, budget, headcount, mFont,
}: {
  name: string;
  spent: number;
  budget: number | null;
  headcount: number | null;
  mFont: React.CSSProperties;
}) {
  const pct = budget && budget > 0 ? Math.min(100, (spent / budget) * 100) : null;
  const barColor = pct == null ? "#1A3A52" : pct > 90 ? "#DC2626" : pct > 70 ? "#F59E0B" : "#1A3A52";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-black" style={mFont}>{name}</p>
          {headcount != null && headcount > 0 && (
            <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{headcount} collaborateur{headcount !== 1 ? "s" : ""}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-black" style={mFont}>
            {spent.toLocaleString("fr-FR")} €
          </p>
          {budget != null && budget > 0 && (
            <p className="text-[11px] text-[#9CA3AF]" style={mFont}>
              / {budget.toLocaleString("fr-FR")} €
            </p>
          )}
        </div>
      </div>
      {/* Barre */}
      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
        {spent > 0 && (
          <div
            className="h-full rounded-full"
            style={{ width: pct != null ? `${pct}%` : "4px", backgroundColor: barColor }}
          />
        )}
      </div>
      {pct != null && (
        <div className="flex justify-between">
          <span className="text-[10px] text-[#9CA3AF]" style={mFont}>{Math.round(pct)} % consommé</span>
          {budget != null && spent <= budget && (
            <span className="text-[10px] text-[#9CA3AF]" style={mFont}>
              {(budget - spent).toLocaleString("fr-FR")} € restants
            </span>
          )}
        </div>
      )}
    </div>
  );
}
