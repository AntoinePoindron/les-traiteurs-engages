import { createClient } from "@/lib/supabase/server";
import { dismissNotifications } from "@/lib/notifications";
import Link from "next/link";
import {
  Building2, Users, Euro, Plus, Trash2,
  BarChart3, HeartHandshake, Briefcase, Info,
} from "lucide-react";
import type { CompanyService, CompanyEmployee, CatererStructureType } from "@/types/database";
import { STRUCTURE_TYPE_GROUP } from "@/types/database";
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

// On a fusionné les anciens tabs `services` et `effectifs` en un seul
// (clé `services` conservée pour compat avec les redirects des server
// actions). La clé `effectifs` acceptée en entrée (URL legacy) est
// normalisée vers `services` plus bas.
type Tab = "services" | "depenses";

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
  // Normalise la clé `effectifs` (legacy, avant la fusion) vers `services`
  // pour que les anciens liens (emails, bookmarks) continuent de pointer
  // au bon endroit.
  const normalizedTab = tab === "effectifs" ? "services" : tab;
  const activeTab: Tab = (normalizedTab as Tab) || "services";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user!.id;

  const { data: profile } = await supabase
    .from("users").select("company_id, role").eq("id", user!.id).single();
  const companyId = (profile as { company_id: string | null; role: string } | null)?.company_id ?? null;

  // ── Dismissal contextuel ──
  // L'admin client arrive sur l'onglet Effectifs → on dégage les notifs
  // "collaborateur en attente de validation". On ne scope pas par tab
  // (si l'admin est sur services puis clique Effectifs, même logique —
  // il a vu la page, il gère).
  await dismissNotifications({
    userId: currentUserId,
    types: ["collaborator_pending"],
  });

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

  // ── Fetch dépenses pour le suivi impact social ─────────────
  // orders → quotes → quote_requests.company_service_id (bar chart)
  //        → quotes.caterers.structure_type (SIAE vs STPA)
  //        → quotes.caterer_id (comptage prestataires distincts)
  // Filtré sur l'année en cours uniquement (le suivi impact se
  // raisonne sur l'exercice calendaire).
  const CURRENT_YEAR = new Date().getFullYear();
  const yearStart = `${CURRENT_YEAR}-01-01T00:00:00Z`;
  const yearEnd   = `${CURRENT_YEAR + 1}-01-01T00:00:00Z`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersForExpenses } = await (supabase as any)
    .from("orders")
    .select(`
      created_at,
      quotes!inner (
        total_amount_ht,
        caterer_id,
        caterers ( id, structure_type ),
        quote_requests!inner (
          company_id,
          company_service_id
        )
      )
    `)
    .eq("quotes.quote_requests.company_id", companyId ?? "")
    .in("status", ["confirmed", "delivered", "invoiced", "paid"])
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  // ── Agrégations ─────────────────────────────────────────────
  // Tous les traiteurs de la plateforme sont inclusifs par définition
  // (ESAT, EA, EI, ACI). Donc "achats inclusifs" = total des commandes.
  // Le montant `total_amount_ht` est le HT du devis traiteur, hors
  // frais de mise en relation et hors commission plateforme.
  const spendByService: Record<string, number> = {};
  const spendByGroup: Record<"STPA" | "SIAE", number> = { STPA: 0, SIAE: 0 };
  const distinctCatererIds = new Set<string>();

  for (const order of ordersForExpenses ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o: any = order;
    const sid = o.quotes?.quote_requests?.company_service_id as string | null;
    const amount = Number(o.quotes?.total_amount_ht ?? 0);
    const catererId = o.quotes?.caterer_id as string | null;
    const structureType = o.quotes?.caterers?.structure_type as
      | CatererStructureType
      | null;

    if (sid) {
      spendByService[sid] = (spendByService[sid] ?? 0) + amount;
    }
    if (structureType) {
      const group = STRUCTURE_TYPE_GROUP[structureType];
      if (group) spendByGroup[group] = (spendByGroup[group] ?? 0) + amount;
    }
    if (catererId) distinctCatererIds.add(catererId);
  }

  const totalSpent = (ordersForExpenses ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, o: any) => sum + Number(o.quotes?.total_amount_ht ?? 0),
    0,
  );
  const totalBudget = services.reduce((s, sv) => s + (sv.annual_budget ?? 0), 0);

  // Estimation du nombre de postes en insertion soutenus.
  // Ratio de ~45K€ TTC par poste annuel (estimation sectorielle sur
  // un échantillon non représentatif — c'est une convention de calcul,
  // pas un chiffre exact).
  const JOBS_PER_EURO = 1 / 45_000;
  const estimatedJobsSupported = Math.round(totalSpent * JOBS_PER_EURO);

  // Répartition en pourcentage (évite division par zéro)
  const stpaPct = totalSpent > 0 ? Math.round((spendByGroup.STPA / totalSpent) * 100) : 0;
  const siaePct = totalSpent > 0 ? Math.round((spendByGroup.SIAE / totalSpent) * 100) : 0;
  const distinctCaterersCount = distinctCatererIds.size;

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
            Équipe
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
              { key: "services",  label: "Services & Effectifs", icon: Users },
              { key: "depenses",  label: "Suivi impact social", icon: HeartHandshake },
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

          {/* ── TAB : SERVICES & EFFECTIFS (fusionné) ── */}
          {activeTab === "services" && (
            <div className="flex flex-col gap-4">

              {/* Bandeau d'erreur (échec d'invitation effectif) */}
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
                      const mInitials =
                        ((member.first_name?.[0] ?? "") + (member.last_name?.[0] ?? "")).toUpperCase() ||
                        member.email[0].toUpperCase();
                      const askedAt = new Date(member.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short",
                      });
                      return (
                        <div key={member.id} className="py-2 flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: "#F59E0B", ...mFont }}
                          >
                            {mInitials}
                          </div>
                          <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-bold text-black truncate" style={mFont}>
                              {fullName}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF] truncate" style={mFont}>
                              {member.email} · {askedAt}
                            </span>
                          </div>
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

              {/* ─────────────── Section SERVICES ─────────────── */}
              <div className="flex items-center justify-between">
                <h2
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Services
                </h2>
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

              {/* ─────────────── Section EFFECTIFS ─────────────── */}
              <div className="flex items-center justify-between mt-2">
                <h2
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Effectifs
                </h2>
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

          {/* ── TAB : SUIVI IMPACT SOCIAL ── */}
          {activeTab === "depenses" && (
            <div className="flex flex-col gap-4">

              {/* Montant total des achats inclusifs (bandeau pleine largeur) */}
              <div
                className="rounded-lg p-6 flex items-center gap-5"
                style={{ backgroundColor: "#1A3A52", color: "white" }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <HeartHandshake size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs opacity-80" style={mFont}>
                    Montant total des achats inclusifs en {CURRENT_YEAR}
                  </p>
                  <p
                    className="font-display font-bold text-3xl"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {totalSpent > 0 ? totalSpent.toLocaleString("fr-FR") + " € HT" : "—"}
                  </p>
                  <p className="text-[11px] opacity-70 mt-1" style={mFont}>
                    Somme des dépenses sur l&apos;année, HT, hors frais de mise en relation &amp; de commission.
                  </p>
                </div>
              </div>

              {/* Répartition SIAE / STPA (2 colonnes) */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Répartition des achats inclusifs
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <ImpactGroupCard
                    title="STPA"
                    subtitle="Travail protégé &amp; adapté (ESAT, EA)"
                    amount={spendByGroup.STPA}
                    pct={stpaPct}
                    color="#6B7C4A"
                    mFont={mFont}
                  />
                  <ImpactGroupCard
                    title="SIAE"
                    subtitle="Insertion par l&apos;activité économique (EI, ACI)"
                    amount={spendByGroup.SIAE}
                    pct={siaePct}
                    color="#C4714A"
                    mFont={mFont}
                  />
                </div>
                {/* Barre répartition (mini visualisation) */}
                {totalSpent > 0 && (
                  <div className="flex h-2 rounded-full overflow-hidden">
                    {spendByGroup.STPA > 0 && (
                      <div
                        style={{
                          width: `${stpaPct}%`,
                          backgroundColor: "#6B7C4A",
                        }}
                      />
                    )}
                    {spendByGroup.SIAE > 0 && (
                      <div
                        style={{
                          width: `${siaePct}%`,
                          backgroundColor: "#C4714A",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Postes soutenus + prestataires distincts (2 colonnes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Postes en insertion soutenus */}
                <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#F0F4F7" }}
                    >
                      <Briefcase size={17} style={{ color: "#1A3A52" }} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <p className="text-xs text-[#6B7280]" style={mFont}>
                        Postes en insertion soutenus
                      </p>
                      {/* Tooltip d'info — hover */}
                      <span className="group relative inline-flex items-center">
                        <Info size={12} className="text-[#9CA3AF] cursor-help" />
                        <span
                          className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 rounded shadow-lg z-10 text-[11px] font-normal leading-snug text-left"
                          style={{ backgroundColor: "#1A3A52", color: "#FFF", ...mFont }}
                          role="tooltip"
                        >
                          Il s&apos;agit d&apos;une estimation basée sur le
                          mode de calcul d&apos;un échantillon non
                          représentatif de l&apos;ensemble des prestataires
                          inclusifs (~45&nbsp;000&nbsp;€ / poste annuel).
                        </span>
                      </span>
                    </div>
                  </div>
                  <p
                    className="font-display font-bold text-3xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {estimatedJobsSupported > 0 ? estimatedJobsSupported : "—"}
                  </p>
                </div>

                {/* Nombre de prestataires inclusifs */}
                <div className="bg-white rounded-lg p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#F0F4F7" }}
                    >
                      <Users size={17} style={{ color: "#1A3A52" }} />
                    </div>
                    <p className="text-xs text-[#6B7280]" style={mFont}>
                      Prestataires inclusifs mobilisés
                    </p>
                  </div>
                  <p
                    className="font-display font-bold text-3xl text-black"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {distinctCaterersCount > 0 ? distinctCaterersCount : "—"}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]" style={mFont}>
                    Traiteurs différents sollicités depuis le {String(CURRENT_YEAR)}.
                  </p>
                </div>
              </div>

              {/* Répartition des achats par service (bar chart, inchangé) */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Répartition des achats par service
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

function ImpactGroupCard({
  title,
  subtitle,
  amount,
  pct,
  color,
  mFont,
}: {
  title: string;
  subtitle: string;
  amount: number;
  pct: number;
  color: string;
  mFont: React.CSSProperties;
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ backgroundColor: "#FAFAF7" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <p className="text-sm font-bold text-black" style={mFont}>
          {title}
        </p>
        <span
          className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: color, color: "white", ...mFont }}
        >
          {pct} %
        </span>
      </div>
      <p
        className="font-display font-bold text-xl text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {amount > 0 ? amount.toLocaleString("fr-FR") + " € HT" : "—"}
      </p>
      <p className="text-[11px] text-[#9CA3AF] leading-snug" style={mFont}>
        {subtitle}
      </p>
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
