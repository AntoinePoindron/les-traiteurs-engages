import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { Section, InfoRow, KpiCard } from "@/components/admin/DetailPageAtoms";
import MessageUserButton from "@/components/admin/MessageUserButton";
import Link from "next/link";
import {
  Building2, MapPin, FileText, ShoppingBag, Users, Euro,
  Mail, Briefcase, ChevronRight, Hash,
} from "lucide-react";
import type { QuoteRequestStatus, UserRole } from "@/types/database";

// Never serve from cache: client content (requests, users, services) changes continuously.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const ROLE_LABELS: Record<UserRole, string> = {
  client_admin: "Admin client",
  client_user:  "Collaborateur",
  caterer:      "Traiteur",
  super_admin:  "Super admin",
};

const ACTIVE_REQUEST_STATUSES: QuoteRequestStatus[] = [
  "pending_review", "approved", "sent_to_caterers",
];

// Map DB status to StatusBadge variant for the activity section
type RequestBadgeVariant = "awaiting_quotes" | "quotes_received" | "completed" | "cancelled" | "quotes_refused";
function resolveRequestVariant(status: QuoteRequestStatus, hasQuotes: boolean): RequestBadgeVariant {
  if (status === "cancelled")      return "cancelled";
  if (status === "completed")      return "completed";
  if (status === "quotes_refused") return "quotes_refused";
  if (hasQuotes)                   return "quotes_received";
  return "awaiting_quotes";
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Company + nested data (users, services, requests, orders) ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companyRaw } = await (supabase as any)
    .from("companies")
    .select(`
      id, name, siret, address, city, zip_code,
      oeth_eligible, budget_annual, logo_url, created_at,
      users ( id, first_name, last_name, email, role, created_at ),
      company_services ( id, name, annual_budget ),
      company_employees ( id, first_name, last_name, email, position, service_id, created_at ),
      quote_requests ( id, title, status, created_at, event_date, quotes ( id, status, total_amount_ht ) )
    `)
    .eq("id", id)
    .single();

  if (!companyRaw) notFound();

  const company = companyRaw as {
    id: string;
    name: string;
    siret: string | null;
    address: string | null;
    city: string | null;
    zip_code: string | null;
    oeth_eligible: boolean;
    budget_annual: number | null;
    logo_url: string | null;
    created_at: string;
    users: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
      role: UserRole;
      created_at: string;
    }[] | null;
    company_services: {
      id: string;
      name: string;
      annual_budget: number;
    }[] | null;
    company_employees: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      position: string | null;
      service_id: string | null;
      created_at: string;
    }[] | null;
    quote_requests: {
      id: string;
      title: string;
      status: QuoteRequestStatus;
      created_at: string;
      event_date: string;
      quotes: { id: string; status: string; total_amount_ht: number | null }[] | null;
    }[] | null;
  };

  // ── Derived data ────────────────────────────────────────────

  const users = company.users ?? [];
  const services = company.company_services ?? [];
  const employees = company.company_employees ?? [];
  const requests = company.quote_requests ?? [];

  const activeRequests = requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status));

  // Orders = accepted quotes => count + total amount
  const acceptedQuotes = requests.flatMap((r) =>
    (r.quotes ?? []).filter((q) => q.status === "accepted")
  );
  const ordersCount = acceptedQuotes.length;
  const caSpent = acceptedQuotes.reduce((sum, q) => sum + (q.total_amount_ht ?? 0), 0);

  const sortedRequests = [...requests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const totalServicesBudget = services.reduce((sum, s) => sum + (s.annual_budget ?? 0), 0);

  // Users with/without account
  const employeesWithoutAccount = employees.filter(
    (emp) => !users.some((u) => u.email === emp.email),
  );

  // Format helpers
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const formatMoney = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Current admin (for excluding from message buttons)
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const adminUserId = adminUser!.id;

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton label="Retour" />

          {/* Titre */}
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white shadow-sm flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#E5EDF2" }}>
                <Building2 size={22} style={{ color: "#1A3A52" }} />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {company.name}
              </h1>
              <p className="text-sm text-[#6B7280] mt-1" style={mFont}>
                {[company.city, `Inscrite le ${formatDate(company.created_at)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          {/* Grid: infos à gauche, activité à droite */}
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">

            {/* ── Colonne gauche : Infos + Contact ── */}
            <div className="flex flex-col gap-6">

              {/* Informations */}
              <Section title="Informations">
                {company.oeth_eligible && (
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                    >
                      OETH éligible
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-3 border-t border-[#F3F4F6]">
                  <InfoRow icon={Hash} label="SIRET" value={company.siret} />
                  <InfoRow
                    icon={MapPin}
                    label="Adresse"
                    value={(company.address || company.city)
                      ? [
                          company.address,
                          [company.zip_code, company.city].filter(Boolean).join(" "),
                        ].filter(Boolean).join(" · ")
                      : null}
                  />
                  <InfoRow
                    icon={Euro}
                    label="Budget annuel"
                    value={company.budget_annual != null ? `${formatMoney(company.budget_annual)} €` : null}
                  />
                </div>
              </Section>

              {/* Contact(s) — les admins client de la structure */}
              {(() => {
                const adminContacts = users.filter((u) => u.role === "client_admin");
                if (adminContacts.length === 0) return null;
                return (
                  <Section title={adminContacts.length > 1 ? `Contacts (${adminContacts.length})` : "Contact"}>
                    <div className="flex flex-col divide-y divide-[#F3F4F6]">
                      {adminContacts.map((c) => {
                        const name =
                          `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email;
                        const initial = name.slice(0, 1).toUpperCase();
                        return (
                          <div key={c.id} className="flex items-center justify-between py-2.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                                style={{ backgroundColor: "#1A3A52", ...mFont }}
                              >
                                {initial}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <p className="text-sm font-bold text-black truncate" style={mFont}>{name}</p>
                                <p className="text-xs text-[#6B7280] truncate" style={mFont}>{c.email}</p>
                              </div>
                            </div>
                            {c.id !== adminUserId && (
                              <MessageUserButton recipientUserId={c.id} variant="icon" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                );
              })()}
            </div>

            {/* ── Colonne droite : Activité ── */}
            <div className="flex flex-col gap-6">

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard icon={FileText}    label="Demandes actives" value={String(activeRequests.length)} />
                <KpiCard icon={ShoppingBag} label="Commandes"        value={String(ordersCount)} />
                <KpiCard icon={Euro}        label="CA consommé"      value={caSpent > 0 ? `${formatMoney(caSpent)} €` : "—"} />
                <KpiCard icon={Users}       label="Utilisateurs"     value={String(users.length)} />
              </div>

              {/* Services internes */}
              {services.length > 0 && (
                <Section title={`Services internes (${services.length})`}>
                  {company.budget_annual != null && totalServicesBudget > 0 && (
                    <p className="text-xs text-[#6B7280]" style={mFont}>
                      Budget total alloué aux services : {formatMoney(totalServicesBudget)} €
                      {company.budget_annual != null && ` / ${formatMoney(company.budget_annual)} € (${Math.round((totalServicesBudget / company.budget_annual) * 100)}%)`}
                    </p>
                  )}
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {services.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Briefcase size={14} className="text-[#9CA3AF] shrink-0" />
                          <p className="text-sm font-bold text-black truncate" style={mFont}>{s.name}</p>
                        </div>
                        <p className="text-xs text-[#6B7280] shrink-0" style={mFont}>
                          {formatMoney(s.annual_budget)} € / an
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Équipe */}
              {(users.length > 0 || employeesWithoutAccount.length > 0) && (
                <Section title={`Équipe (${users.length + employeesWithoutAccount.length})`}>
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {users.map((u) => {
                      const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
                      return (
                        <div key={u.id} className="flex items-center justify-between py-2.5 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold" style={{ backgroundColor: "#1A3A52" }}>
                              {name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-sm font-bold text-black truncate" style={mFont}>{name}</p>
                              <p className="text-xs text-[#6B7280] truncate" style={mFont}>{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: u.role === "client_admin" ? "#E0F2FE" : "#F0F4F8",
                                color: u.role === "client_admin" ? "#075985" : "#1A3A52",
                                ...mFont,
                              }}
                            >
                              {ROLE_LABELS[u.role]}
                            </span>
                            {u.id !== adminUserId && (
                              <MessageUserButton recipientUserId={u.id} variant="icon" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {employeesWithoutAccount.map((emp) => {
                      const name = `${emp.first_name} ${emp.last_name}`.trim();
                      return (
                        <div key={emp.id} className="flex items-center justify-between py-2.5 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[#9CA3AF] text-[10px] font-bold" style={{ backgroundColor: "#F3F4F6" }}>
                              <Mail size={10} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-sm font-bold text-black truncate" style={mFont}>{name}</p>
                              <p className="text-xs text-[#6B7280] truncate" style={mFont}>{emp.email ?? "—"}</p>
                            </div>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: "#FEF3C7", color: "#92400E", ...mFont }}
                          >
                            Invité·e
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Activité récente */}
              <Section title="Demandes récentes">
                {sortedRequests.length === 0 ? (
                  <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                    Aucune demande enregistrée.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {sortedRequests.map((req) => {
                      const hasQuotes = (req.quotes ?? []).length > 0;
                      const hasAccepted = (req.quotes ?? []).some((q) => q.status === "accepted");
                      const variant = resolveRequestVariant(req.status, hasQuotes || hasAccepted);
                      return (
                        <Link
                          key={req.id}
                          href={`/admin/qualification/${req.id}`}
                          className="flex items-center justify-between py-2.5 gap-3 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                        >
                          <div className="flex flex-col min-w-0 gap-0.5">
                            <p className="text-sm font-bold text-black truncate" style={mFont}>{req.title}</p>
                            <p className="text-xs text-[#9CA3AF]" style={mFont}>
                              Créée le {formatDate(req.created_at)} · Événement le {formatDate(req.event_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge variant={variant} />
                            <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Section>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

