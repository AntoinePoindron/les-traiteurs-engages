import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Building2, ChefHat, Users, FileText, ShoppingBag, Euro,
  TrendingUp, TrendingDown, Minus, ChevronRight,
} from "lucide-react";

// Never cache — stats should always reflect the latest data.
export const dynamic = "force-dynamic";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_LABELS: Record<string, string> = {
  petit_dejeuner:        "Petit déjeuner",
  pause_gourmande:       "Pause gourmande",
  plateaux_repas:        "Plateaux repas",
  cocktail_dinatoire:    "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif:     "Cocktail apéritif",
};

const ACCEPTED_ORDER_STATUSES = ["confirmed", "delivered", "invoiced", "paid"];

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function pctDelta(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { value: 0, direction: "flat" };
    return { value: 100, direction: "up" };
  }
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 1) return { value: 0, direction: "flat" };
  return { value: Math.round(Math.abs(delta)), direction: delta > 0 ? "up" : "down" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export default async function AdminStatsPage() {
  const supabase = await createClient();

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(new Date(thisMonthStart.getTime() - 1));

  // Last 6 months buckets (oldest first)
  const monthBuckets: { start: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ start: d, label: monthLabel(d) });
  }
  const rangeStart = monthBuckets[0].start;

  // ── Parallel queries ────────────────────────────────────────

  const [
    companiesCount,
    catererTotals,
    usersCount,
    allRequests,
    allOrders,
  ] = await Promise.all([
    // 1. Companies total count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("companies").select("*", { count: "exact", head: true }),
    // 2. Caterers with is_validated breakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("caterers").select("id, is_validated"),
    // 3. Users total count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("users").select("id, role"),
    // 4. All requests in the 6-month window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("quote_requests")
      .select("id, status, created_at, service_type, meal_type, quotes(id, status, total_amount_ht)")
      .gte("created_at", rangeStart.toISOString()),
    // 5. All orders in the 6-month window, with caterer and company info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("orders")
      .select(`
        id, status, created_at,
        quotes!inner (
          total_amount_ht, caterer_id,
          caterers ( id, name, city, logo_url ),
          quote_requests ( company_id, companies ( id, name, city, logo_url ) )
        )
      `)
      .gte("created_at", rangeStart.toISOString()),
  ]);

  const companiesTotal = companiesCount.count ?? 0;
  const caterers = (catererTotals.data ?? []) as Row[];
  const validatedCaterers = caterers.filter((c) => c.is_validated).length;
  const users = (usersCount.data ?? []) as Row[];
  const requests = (allRequests.data ?? []) as Row[];
  const orders = (allOrders.data ?? []) as Row[];

  // ── Current + previous month metrics ────────────────────────

  const requestsThisMonth = requests.filter(
    (r) => new Date(r.created_at) >= thisMonthStart
  ).length;
  const requestsPrevMonth = requests.filter(
    (r) =>
      new Date(r.created_at) >= prevMonthStart &&
      new Date(r.created_at) < thisMonthStart
  ).length;

  const ordersThisMonth = orders.filter(
    (o) => new Date(o.created_at) >= thisMonthStart
  ).length;
  const ordersPrevMonth = orders.filter(
    (o) =>
      new Date(o.created_at) >= prevMonthStart &&
      new Date(o.created_at) < thisMonthStart
  ).length;

  const sumOrders = (list: Row[]): number =>
    list.reduce((sum, o) => sum + Number(o.quotes?.total_amount_ht ?? 0), 0);

  const caThisMonth = sumOrders(orders.filter(
    (o) => new Date(o.created_at) >= thisMonthStart
  ));
  const caPrevMonth = sumOrders(orders.filter(
    (o) =>
      new Date(o.created_at) >= prevMonthStart &&
      new Date(o.created_at) < thisMonthStart
  ));

  // ── 6-month activity buckets ────────────────────────────────

  const nextMonthStarts: Date[] = monthBuckets.slice(1).map((b) => b.start);
  nextMonthStarts.push(startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1)));

  const activityData = monthBuckets.map((b, idx) => {
    const end = nextMonthStarts[idx];
    const reqCount = requests.filter(
      (r) => new Date(r.created_at) >= b.start && new Date(r.created_at) < end
    ).length;
    const ordCount = orders.filter(
      (o) => new Date(o.created_at) >= b.start && new Date(o.created_at) < end
    ).length;
    return { label: b.label, requests: reqCount, orders: ordCount };
  });
  const maxActivity = Math.max(1, ...activityData.flatMap((a) => [a.requests, a.orders]));

  // ── Top caterers / companies ────────────────────────────────

  const acceptedOrders = orders.filter((o) => ACCEPTED_ORDER_STATUSES.includes(o.status));

  const catererAgg = new Map<string, { id: string; name: string; city: string | null; logo_url: string | null; ca: number; count: number }>();
  const companyAgg = new Map<string, { id: string; name: string; city: string | null; logo_url: string | null; ca: number; count: number }>();

  for (const o of acceptedOrders) {
    const amount = Number(o.quotes?.total_amount_ht ?? 0);
    const cat = o.quotes?.caterers;
    if (cat?.id) {
      const entry = catererAgg.get(cat.id) ?? {
        id: cat.id, name: cat.name, city: cat.city, logo_url: cat.logo_url, ca: 0, count: 0,
      };
      entry.ca += amount;
      entry.count += 1;
      catererAgg.set(cat.id, entry);
    }
    const comp = o.quotes?.quote_requests?.companies;
    if (comp?.id) {
      const entry = companyAgg.get(comp.id) ?? {
        id: comp.id, name: comp.name, city: comp.city, logo_url: comp.logo_url, ca: 0, count: 0,
      };
      entry.ca += amount;
      entry.count += 1;
      companyAgg.set(comp.id, entry);
    }
  }

  const topCaterers = Array.from(catererAgg.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);
  const topCompanies = Array.from(companyAgg.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);

  // ── Service type breakdown ──────────────────────────────────

  const serviceAgg = new Map<string, number>();
  for (const r of requests) {
    const key = r.service_type ?? r.meal_type ?? "autre";
    serviceAgg.set(key, (serviceAgg.get(key) ?? 0) + 1);
  }
  const totalServiceRequests = [...serviceAgg.values()].reduce((s, n) => s + n, 0);
  const serviceBreakdown = Array.from(serviceAgg.entries())
    .map(([key, count]) => ({
      key,
      label: SERVICE_LABELS[key] ?? key,
      count,
      pct: totalServiceRequests > 0 ? Math.round((count / totalServiceRequests) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── User breakdown by role ──────────────────────────────────

  const userRoleCounts = users.reduce((acc: Record<string, number>, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  // ── Render helpers ──────────────────────────────────────────

  const reqDelta = pctDelta(requestsThisMonth, requestsPrevMonth);
  const ordDelta = pctDelta(ordersThisMonth, ordersPrevMonth);
  const caDelta = pctDelta(caThisMonth, caPrevMonth);

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Statistiques
          </h1>

          {/* Bloc 1 : KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard
              icon={Building2}
              label="Clients"
              value={String(companiesTotal)}
              subtitle={`${userRoleCounts.client_admin ?? 0} admin + ${userRoleCounts.client_user ?? 0} collab.`}
            />
            <KpiCard
              icon={ChefHat}
              label="Traiteurs validés"
              value={String(validatedCaterers)}
              subtitle={caterers.length > validatedCaterers ? `${caterers.length - validatedCaterers} en attente` : undefined}
            />
            <KpiCard
              icon={Users}
              label="Utilisateurs"
              value={String(users.length)}
              subtitle={`${userRoleCounts.caterer ?? 0} traiteurs`}
            />
            <KpiCard
              icon={FileText}
              label="Demandes ce mois"
              value={String(requestsThisMonth)}
              delta={reqDelta}
            />
            <KpiCard
              icon={ShoppingBag}
              label="Commandes ce mois"
              value={String(ordersThisMonth)}
              delta={ordDelta}
            />
            <KpiCard
              icon={Euro}
              label="CA HT ce mois"
              value={caThisMonth > 0 ? `${formatMoney(caThisMonth)} €` : "0 €"}
              delta={caDelta}
            />
          </div>

          {/* Bloc 2 : Activité 6 mois */}
          <Section title="Activité des 6 derniers mois">
            <div className="flex items-end justify-between gap-2 h-44 pt-2 pb-1">
              {activityData.map((a, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex items-end justify-center gap-1.5" style={{ height: 140 }}>
                    <Bar height={(a.requests / maxActivity) * 140} color="#1A3A52" value={a.requests} title="Demandes" />
                    <Bar height={(a.orders   / maxActivity) * 140} color="#16A34A" value={a.orders}   title="Commandes" />
                  </div>
                  <p className="text-[10px] text-[#6B7280] whitespace-nowrap" style={mFont}>
                    {a.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 pt-3 border-t border-[#F3F4F6]">
              <Legend color="#1A3A52" label="Demandes" />
              <Legend color="#16A34A" label="Commandes" />
            </div>
          </Section>

          {/* Bloc 3 : Top listings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Top 5 traiteurs">
              {topCaterers.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                  Pas encore de commandes confirmées.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#F3F4F6]">
                  {topCaterers.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/admin/caterers/${c.id}`}
                      className="flex items-center gap-3 py-2.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                    >
                      <RankBadge rank={i + 1} />
                      <LogoTile logoUrl={c.logo_url} fallback={<ChefHat size={16} style={{ color: "#1A3A52" }} />} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-bold text-black truncate" style={mFont}>{c.name}</p>
                        {c.city && <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{c.city}</p>}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <p className="text-sm font-bold text-black" style={mFont}>{formatMoney(c.ca)} €</p>
                        <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{c.count} cmd</p>
                      </div>
                      <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Top 5 clients">
              {topCompanies.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                  Pas encore de dépenses confirmées.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#F3F4F6]">
                  {topCompanies.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/admin/companies/${c.id}`}
                      className="flex items-center gap-3 py-2.5 -mx-2 px-2 hover:bg-[#F5F1E8] rounded-lg transition-colors group"
                    >
                      <RankBadge rank={i + 1} />
                      <LogoTile logoUrl={c.logo_url} fallback={<Building2 size={16} style={{ color: "#1A3A52" }} />} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-bold text-black truncate" style={mFont}>{c.name}</p>
                        {c.city && <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{c.city}</p>}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <p className="text-sm font-bold text-black" style={mFont}>{formatMoney(c.ca)} €</p>
                        <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{c.count} cmd</p>
                      </div>
                      <ChevronRight size={14} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Bloc 4 : breakdown par type de prestation */}
          <Section title="Répartition par type de prestation (6 derniers mois)">
            {serviceBreakdown.length === 0 ? (
              <p className="text-sm text-[#6B7280] py-4 text-center" style={mFont}>
                Aucune demande sur la période.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {serviceBreakdown.map((s) => (
                  <div key={s.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-black" style={mFont}>{s.label}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-[#6B7280]" style={mFont}>{s.pct}%</span>
                        <span className="text-sm font-bold text-black min-w-[32px] text-right" style={mFont}>
                          {s.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(s.pct, 2)}%`, backgroundColor: "#1A3A52" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      </div>
    </main>
  );
}

// ── Atoms ────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  delta,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  delta?: { value: number; direction: "up" | "down" | "flat" };
}) {
  return (
    <div className="bg-white rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0F4F7" }}>
          <Icon size={14} style={{ color: "#1A3A52" }} />
        </div>
        {delta && delta.direction !== "flat" && (
          <span
            className="flex items-center gap-0.5 text-[11px] font-bold"
            style={{
              color: delta.direction === "up" ? "#16A34A" : "#DC2626",
              ...mFont,
            }}
          >
            {delta.direction === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {delta.value}%
          </span>
        )}
        {delta && delta.direction === "flat" && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#9CA3AF]" style={mFont}>
            <Minus size={11} />
            stable
          </span>
        )}
      </div>
      <div>
        <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
          {value}
        </p>
        <p className="text-[11px] text-[#6B7280] mt-0.5" style={mFont}>{label}</p>
        {subtitle && <p className="text-[10px] text-[#9CA3AF] mt-0.5" style={mFont}>{subtitle}</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-5 flex flex-col gap-4">
      <p
        className="font-display font-bold text-lg text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function Bar({ height, color, value, title }: { height: number; color: string; value: number; title: string }) {
  return (
    <div className="flex flex-col items-center justify-end gap-1 flex-1 min-w-0" style={{ height: 140 }}>
      <span className="text-[9px] text-[#6B7280] font-bold" style={mFont}>
        {value > 0 ? value : ""}
      </span>
      <div
        className="w-full rounded-t"
        style={{ height: Math.max(height, 2), minHeight: 2, backgroundColor: color }}
        title={`${title}: ${value}`}
      />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span className="text-xs text-[#6B7280]" style={mFont}>{label}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"]; // gold, silver, bronze
  const bg = rank <= 3 ? colors[rank - 1] : "#E5E7EB";
  const fg = rank <= 3 ? "#1A3A52" : "#6B7280";
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{ backgroundColor: bg, color: fg, ...mFont }}
    >
      {rank}
    </span>
  );
}

function LogoTile({
  logoUrl,
  fallback,
}: {
  logoUrl: string | null;
  fallback: React.ReactNode;
}) {
  if (logoUrl) {
    return (
      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white flex items-center justify-center border border-[#F3F4F6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="w-full h-full object-contain p-0.5" />
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#F5F1E8" }}
    >
      {fallback}
    </div>
  );
}
