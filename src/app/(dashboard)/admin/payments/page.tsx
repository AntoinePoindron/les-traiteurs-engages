import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Euro, TrendingUp, CreditCard, Percent, ChevronRight } from "lucide-react";
import { KpiCard, Section } from "@/components/admin/DetailPageAtoms";

// Always fresh — a new payment may have succeeded since last request.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type PaymentFilter = "all" | "succeeded" | "pending" | "failed";

const FILTER_TABS: { key: PaymentFilter; label: string }[] = [
  { key: "all",       label: "Tous" },
  { key: "succeeded", label: "Réussis" },
  { key: "pending",   label: "En attente" },
  { key: "failed",    label: "Échoués" },
];

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

function formatEuroFromCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "succeeded":  return { label: "Réussi",       color: "#16A34A", bg: "#DCFCE7" };
    case "processing": return { label: "En cours",     color: "#0284C7", bg: "#E0F2FE" };
    case "pending":    return { label: "En attente",   color: "#B45309", bg: "#FEF3C7" };
    case "failed":     return { label: "Échoué",       color: "#DC2626", bg: "#FEE2E2" };
    case "canceled":   return { label: "Annulé",       color: "#6B7280", bg: "#F3F4F6" };
    case "refunded":   return { label: "Remboursé",    color: "#7C3AED", bg: "#EDE9FE" };
    default:           return { label: status,         color: "#6B7280", bg: "#F3F4F6" };
  }
}

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as PaymentFilter) ?? "all";

  const supabase = await createClient();

  // Récupère tous les paiements + détails liés pour l'affichage.
  // RLS garantit déjà que seul super_admin accède à tous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentsRaw } = await (supabase as any)
    .from("payments")
    .select(`
      id, status, amount_total_cents, application_fee_cents, amount_to_caterer_cents,
      currency, succeeded_at, created_at,
      stripe_checkout_session_id, stripe_payment_intent_id,
      caterers ( id, name ),
      orders (
        id,
        quotes (
          quote_requests (
            title,
            companies ( id, name )
          )
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPayments = (paymentsRaw ?? []) as any[];

  // KPIs calculés sur la totalité (avant filtre UI)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const succeeded = allPayments.filter((p: any) => p.status === "succeeded");
  const totalCaCents = succeeded.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.amount_total_cents ?? 0),
    0,
  );
  const totalCommissionCents = succeeded.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.application_fee_cents ?? 0),
    0,
  );
  const totalToCaterersCents = succeeded.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.amount_to_caterer_cents ?? 0),
    0,
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthCaCents = succeeded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.succeeded_at && new Date(p.succeeded_at) >= startOfMonth)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s: number, p: any) => s + Number(p.amount_total_cents ?? 0), 0);

  // Filtre UI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = allPayments.filter((p: any) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "succeeded") return p.status === "succeeded";
    if (activeFilter === "pending") return p.status === "pending" || p.status === "processing";
    if (activeFilter === "failed") return p.status === "failed" || p.status === "canceled";
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
            Paiements
          </h1>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={Euro}
              label="CA total HT"
              value={totalCaCents > 0 ? `${formatEuroFromCents(totalCaCents)} €` : "—"}
            />
            <KpiCard
              icon={TrendingUp}
              label="CA ce mois HT"
              value={monthCaCents > 0 ? `${formatEuroFromCents(monthCaCents)} €` : "—"}
            />
            <KpiCard
              icon={Percent}
              label="Commission plateforme"
              value={totalCommissionCents > 0 ? `${formatEuroFromCents(totalCommissionCents)} €` : "—"}
            />
            <KpiCard
              icon={CreditCard}
              label="Versé aux traiteurs"
              value={totalToCaterersCents > 0 ? `${formatEuroFromCents(totalToCaterersCents)} €` : "—"}
            />
          </div>

          {/* Tabs filtre */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={key === "all" ? "/admin/payments" : `/admin/payments?filter=${key}`}
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
          <Section title={`${filtered.length} paiement${filtered.length !== 1 ? "s" : ""}`}>
            {filtered.length === 0 ? (
              <p className="text-sm text-[#6B7280] py-8 text-center" style={mFont}>
                Aucun paiement correspondant.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {filtered.map((p) => {
                  const qr = p.orders?.quotes?.quote_requests;
                  const company = qr?.companies;
                  const caterer = p.caterers;
                  const title = qr?.title ?? "Commande";
                  const statusMeta = statusLabel(p.status);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-black truncate" style={mFont}>{title}</p>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: statusMeta.bg, color: statusMeta.color, ...mFont }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280] flex-wrap" style={mFont}>
                          {company?.name && (
                            <Link
                              href={`/admin/companies/${company.id}`}
                              className="hover:text-[#1A3A52] underline underline-offset-2"
                            >
                              {company.name}
                            </Link>
                          )}
                          <span>→</span>
                          {caterer?.name && (
                            <Link
                              href={`/admin/caterers/${caterer.id}`}
                              className="hover:text-[#1A3A52] underline underline-offset-2"
                            >
                              {caterer.name}
                            </Link>
                          )}
                          <span className="text-[#9CA3AF]">·</span>
                          <span className="text-[#9CA3AF]">{formatDate(p.succeeded_at ?? p.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <p className="text-sm font-bold text-black" style={mFont}>
                            {formatEuroFromCents(Number(p.amount_total_cents ?? 0))} €
                          </p>
                          <p className="text-[11px] text-[#9CA3AF]" style={mFont}>
                            Commission {formatEuroFromCents(Number(p.application_fee_cents ?? 0))} €
                          </p>
                        </div>
                        <Link
                          href={`/client/orders/${p.orders?.id}`}
                          className="text-[#D1D5DB] hover:text-[#9CA3AF] transition-colors"
                          title="Voir la commande"
                        >
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {allPayments.length >= 200 && (
              <p className="text-[11px] text-[#9CA3AF] text-center pt-2" style={mFont}>
                200 derniers paiements affichés.
              </p>
            )}
          </Section>

        </div>
      </div>
    </main>
  );
}
