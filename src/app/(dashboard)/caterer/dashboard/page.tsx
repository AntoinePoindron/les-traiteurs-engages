import { createClient } from "@/lib/supabase/server";
import RequestCard from "@/components/caterer/RequestCard";
import UpcomingOrdersPanel from "@/components/caterer/UpcomingOrdersPanel";
import Link from "next/link";
import type { QuoteRequest } from "@/types/database";

export default async function CatererDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, caterer_id")
    .eq("id", user!.id)
    .single();

  const profile = profileData as { first_name: string | null; caterer_id: string | null } | null;
  const catererId = profile?.caterer_id;

  // ── KPIs ────────────────────────────────────────────────────
  // Nouvelles demandes (statut sent_to_caterers, assignées à ce traiteur)
  const { count: newRequestsCount } = await supabase
    .from("quote_request_caterers")
    .select("*", { count: "exact", head: true })
    .eq("caterer_id", catererId ?? "")
    .eq("status", "selected");

  // Devis en attente (envoyés, pas encore acceptés)
  const { count: pendingQuotesCount } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("caterer_id", catererId ?? "")
    .eq("status", "sent");

  // Commandes en cours
  const { count: activeOrdersCount } = await supabase
    .from("orders")
    .select("*, quotes!inner(caterer_id)", { count: "exact", head: true })
    .eq("quotes.caterer_id", catererId ?? "")
    .in("status", ["confirmed", "in_progress"]);

  // CA prévisionnel du mois (commandes confirmées ce mois-ci)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthOrders } = await supabase
    .from("orders")
    .select("quotes!inner(total_amount_ht, caterer_id)")
    .eq("quotes.caterer_id", catererId ?? "")
    .gte("created_at", startOfMonth.toISOString())
    .in("status", ["confirmed", "in_progress", "delivered", "invoiced", "paid"]);

  const caMonthly = (monthOrders ?? []).reduce((sum, o) => {
    const q = (o as { quotes: { total_amount_ht: number } | null }).quotes;
    return sum + (q?.total_amount_ht ?? 0);
  }, 0);

  // ── Demandes à traiter ──────────────────────────────────────
  const { data: assignedRequests } = await supabase
    .from("quote_request_caterers")
    .select(`
      status,
      quote_requests (
        id, title, event_date, event_address, guest_count,
        budget_global, meal_type,
        users ( first_name, last_name )
      )
    `)
    .eq("caterer_id", catererId ?? "")
    .in("status", ["selected", "responded"])
    .order("created_at", { ascending: false })
    .limit(5);

  const requests = (assignedRequests ?? [])
    .map((row) => {
      const r = row as {
        status: string;
        quote_requests: (QuoteRequest & { users: { first_name: string | null; last_name: string | null } | null }) | null;
      };
      if (!r.quote_requests) return null;
      const u = r.quote_requests.users;
      return {
        ...r.quote_requests,
        client_name: u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : undefined,
        is_new: r.status === "selected",
      };
    })
    .filter(Boolean) as Array<Parameters<typeof RequestCard>[0]["request"]>;

  // ── Commandes à venir ───────────────────────────────────────
  const { data: upcomingOrdersData } = await supabase
    .from("orders")
    .select(`
      id, delivery_date, delivery_address,
      quotes!inner (
        caterer_id,
        quote_requests ( company_id, companies ( name ) )
      )
    `)
    .eq("quotes.caterer_id", catererId ?? "")
    .eq("status", "confirmed")
    .gte("delivery_date", new Date().toISOString())
    .order("delivery_date", { ascending: true })
    .limit(3);

  const upcomingOrders = (upcomingOrdersData ?? []).map((o) => {
    const order = o as {
      id: string;
      delivery_date: string;
      delivery_address: string;
      quotes: {
        quote_requests: {
          companies: { name: string } | null;
        } | null;
      } | null;
    };
    return {
      id: order.id,
      delivery_date: order.delivery_date,
      delivery_address: order.delivery_address,
      company_name: order.quotes?.quote_requests?.companies?.name ?? "—",
    };
  });

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <h1
            className="font-display font-bold text-4xl mb-6"
            style={{ color: "#1A3A52", fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Tableau de bord
          </h1>

          {/* ── Chiffres clés ── */}
          <div className="bg-white rounded-lg p-6 mb-6 relative overflow-hidden">
            <h2
              className="font-display font-bold text-2xl text-black mb-6"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Chiffres clés
            </h2>

            <div className="flex gap-12 flex-wrap pr-36">
              <KpiStat value={String(newRequestsCount ?? 0)} label="Nouvelles demandes" />
              <KpiStat value={String(pendingQuotesCount ?? 0)} label="Devis en attente" />
              <KpiStat value={String(activeOrdersCount ?? 0)} label="Commandes en cours" />
              <KpiStat
                value={caMonthly > 0 ? `${caMonthly.toLocaleString("fr-FR")} €` : "—"}
                label="CA prévisionnel du mois"
              />
            </div>

            {/* Image décorative (bas droite) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/decoration-chiffres-cles.png"
              alt=""
              aria-hidden
              className="absolute bottom-0 right-0 h-36 w-auto pointer-events-none select-none"
            />
          </div>

          {/* ── Contenu principal : demandes + panneau droit ── */}
          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* Colonne gauche : demandes à traiter */}
            <div className="flex-1 min-w-0 w-full bg-white rounded-lg p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2
                  className="font-display font-bold text-2xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Demandes à traiter
                </h2>
                <Link
                  href="/caterer/requests"
                  className="text-xs font-bold text-navy underline"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  Voir toute la liste
                </Link>
              </div>

              {requests.length === 0 ? (
                <p className="text-sm text-gray-medium py-4" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                  Aucune demande en attente.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {requests.map((req) => (
                    <RequestCard key={req.id} request={req} />
                  ))}
                </div>
              )}
            </div>

            {/* Colonne droite : commandes à venir */}
            <div className="w-full md:w-auto md:shrink-0">
              <UpcomingOrdersPanel orders={upcomingOrders} />
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

function KpiStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      <p
        className="font-display font-bold text-2xl"
        style={{ color: "#1A3A52", fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {value}
      </p>
      <p
        className="text-base text-black"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}
