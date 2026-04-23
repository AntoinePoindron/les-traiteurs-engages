import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import ClientFilterTabs from "@/components/client/ClientFilterTabs";
import ClientRequestCard from "@/components/client/ClientRequestCard";
import type { ClientRequestFilter } from "@/components/client/ClientFilterTabs";
import type { ClientRequestCardData } from "@/components/client/ClientRequestCard";
import type { QuoteRequestStatus } from "@/types/database";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import NewRequestDropdown from "@/components/client/NewRequestDropdown";
import { dismissNotifications } from "@/lib/notifications";

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string; sort?: string }>;
}

export default async function ClientRequestsPage({ searchParams }: PageProps) {
  const { filter, q, sort } = await searchParams;

  const activeFilter = (filter as ClientRequestFilter) || "all";
  const searchQuery = q || "";
  const sortBy = sort || "date_desc";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Dismissal contextuel (liste) — filet de sécurité ──
  if (user) {
    await dismissNotifications({
      userId: user.id,
      types: ["quote_received"],
    });
  }

  // Rôle + company de l'utilisateur (l'admin voit toute la company)
  const { data: profileData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user!.id)
    .single();
  const profile = profileData as { role: string; company_id: string | null } | null;
  const isAdmin = profile?.role === "client_admin";
  const companyId = profile?.company_id ?? "";

  // ── Requête principale ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("quote_requests")
    .select(`
      id, title, service_type, meal_type, is_compare_mode,
      event_date, event_address, guest_count, budget_global,
      created_at, updated_at, status,
      quote_request_caterers ( status, caterers ( logo_url, name ) ),
      quotes ( status )
    `);
  if (isAdmin) {
    query = query.eq("company_id", companyId);
  } else {
    query = query.eq("client_user_id", user!.id);
  }

  // Filtre statut
  switch (activeFilter) {
    case "pending":
      // "en attente" = pas encore de commande, pas annulé, pas tous les devis refusés
      query = query.not("status", "in", '("completed","cancelled","quotes_refused")');
      break;
    case "closed":
      // "Clôturées" = annulées ou tous devis refusés (les "Commande créée"
      // = status 'completed' sont dans leur propre onglet "accepted").
      query = query.in("status", ["cancelled", "quotes_refused"]);
      break;
    // "quotes" et "accepted" : on filtre après transformation
  }

  // Tri par défaut : la plus récemment mise à jour d'abord (updated_at DESC).
  // `date_asc` garde l'ordre chronologique (la plus ancienne d'abord).
  query = query.order("updated_at", { ascending: sortBy === "date_asc" });

  const { data: rows } = await query;

  // ── Transformation ───────────────────────────────────────────
  type RawRow = {
    id: string;
    title: string;
    service_type: string | null;
    meal_type: string | null;
    is_compare_mode: boolean;
    event_date: string;
    event_address: string;
    guest_count: number;
    budget_global: number | null;
    created_at: string;
    status: QuoteRequestStatus;
    quote_request_caterers: { status: string; caterers: { logo_url: string | null; name: string } | null }[] | null;
    quotes: { status: string }[] | null;
  };

  let requests = ((rows ?? []) as RawRow[]).map((row): ClientRequestCardData => {
    const qrcList = row.quote_request_caterers ?? [];
    const quoteList = row.quotes ?? [];

    const quotesReceivedCount = qrcList.filter(
      (q) => q.status === "transmitted_to_client"
    ).length;

    const hasAcceptedQuote = quoteList.some((q) => q.status === "accepted");

    // Logo du traiteur ciblé (mode direct = 1 traiteur)
    const firstCaterer = qrcList[0]?.caterers ?? null;

    return {
      id:                    row.id,
      title:                 row.title,
      service_type:          row.service_type,
      meal_type:             row.meal_type,
      is_compare_mode:       row.is_compare_mode ?? false,
      event_date:            row.event_date,
      event_address:         row.event_address,
      guest_count:           row.guest_count,
      budget_global:         row.budget_global,
      created_at:            row.created_at,
      status:                row.status,
      quotes_received_count: quotesReceivedCount,
      has_accepted_quote:    hasAcceptedQuote,
      caterer_logo_url:      firstCaterer?.logo_url ?? null,
      caterer_name:          firstCaterer?.name ?? null,
    };
  });

  // Filtres post-transformation
  if (activeFilter === "pending") {
    // "En attente de devis" : aucun devis reçu et pas encore de commande
    requests = requests.filter((r) => r.quotes_received_count === 0 && !r.has_accepted_quote);
  }
  if (activeFilter === "quotes") {
    requests = requests.filter((r) => r.quotes_received_count > 0 && !r.has_accepted_quote);
  }
  if (activeFilter === "accepted") {
    requests = requests.filter((r) => r.has_accepted_quote);
  }

  // Recherche textuelle
  if (searchQuery) {
    const qLower = searchQuery.toLowerCase();
    requests = requests.filter(
      (r) =>
        r.title.toLowerCase().includes(qLower) ||
        r.event_address.toLowerCase().includes(qLower)
    );
  }

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre + CTA */}
          <div className="flex items-center justify-between">
            <h1
              className="font-display font-bold text-4xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Mes demandes
            </h1>
            <NewRequestDropdown />
          </div>

          {/* Filtres */}
          <Suspense>
            <ClientFilterTabs activeFilter={activeFilter} searchQuery={searchQuery} />
          </Suspense>

          {/* Liste */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-bold text-black"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                {requests.length} demande{requests.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-1">
                <span
                  className="text-xs text-black"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  Trier par{" "}
                  <span className="font-bold text-[#1A3A52]">
                    {sortBy === "date_asc" ? "La plus ancienne" : "La plus récente"}
                  </span>
                </span>
                <ChevronDown size={18} className="text-[#1A3A52]" />
              </div>
            </div>

            {/* Cards */}
            {requests.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <p
                  className="text-sm text-[#6B7280]"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  {activeFilter === "all"
                    ? "Vous n'avez pas encore soumis de demande."
                    : "Aucune demande dans cette catégorie."}
                </p>
                {activeFilter === "all" && (
                  <Link
                    href="/client/requests/new"
                    className="text-sm font-bold text-[#1A3A52] underline underline-offset-2 hover:opacity-70 transition-opacity"
                    style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                  >
                    Déposer une demande
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {requests.map((req) => (
                  <ClientRequestCard key={req.id} request={req} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
