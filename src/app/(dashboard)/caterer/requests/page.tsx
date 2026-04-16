import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import RequestCard from "@/components/caterer/RequestCard";
import FilterTabs from "@/components/caterer/FilterTabs";
import type { RequestFilter } from "@/components/caterer/FilterTabs";
import type { QuoteRequest } from "@/types/database";
import { ChevronDown } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string; sort?: string }>;
}

export default async function CatererRequestsPage({ searchParams }: PageProps) {
  const { filter, q, sort } = await searchParams;

  const activeFilter = (filter as RequestFilter) || "all";
  const searchQuery = q || "";
  const sortBy = sort || "date_desc";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user!.id)
    .single();

  const profile = profileData as { caterer_id: string | null } | null;
  const catererId = profile?.caterer_id;

  // ── Pour sent/accepted/refused : filtre sur le statut du devis
  let filteredQuoteRequestIds: string[] | null = null;
  if (activeFilter === "sent" || activeFilter === "accepted" || activeFilter === "refused") {
    const quoteStatus = activeFilter === "sent" ? "sent" : activeFilter;
    const { data: quoteData } = await supabase
      .from("quotes")
      .select("quote_request_id")
      .eq("caterer_id", catererId ?? "")
      .eq("status", quoteStatus);
    filteredQuoteRequestIds = (quoteData ?? []).map(
      (q) => (q as { quote_request_id: string }).quote_request_id
    );
  }

  // ── Requête principale ───────────────────────────────────────
  let query = supabase
    .from("quote_request_caterers")
    .select(`
      status,
      responded_at,
      quote_requests (
        id, title, event_date, event_address,
        guest_count, budget_global, meal_type, description, created_at,
        users ( first_name, last_name ),
        companies ( name ),
        quotes ( status, caterer_id )
      )
    `)
    .eq("caterer_id", catererId ?? "");

  // Filtrage par statut QRC
  switch (activeFilter) {
    case "new":
      query = query.eq("status", "selected");
      break;
    case "pending":
      query = query.eq("status", "responded");
      break;
    case "sent":
      query = query.eq("status", "transmitted_to_client");
      if (filteredQuoteRequestIds && filteredQuoteRequestIds.length > 0) {
        query = query.in("quote_request_id", filteredQuoteRequestIds);
      } else if (filteredQuoteRequestIds !== null) {
        query = query.eq("quote_request_id", "00000000-0000-0000-0000-000000000000");
      }
      break;
    case "archived":
      query = query.eq("status", "rejected");
      break;
    case "accepted":
    case "refused":
      query = query.eq("status", "transmitted_to_client");
      if (filteredQuoteRequestIds && filteredQuoteRequestIds.length > 0) {
        query = query.in("quote_request_id", filteredQuoteRequestIds);
      } else {
        // Aucun résultat attendu
        query = query.eq("quote_request_id", "00000000-0000-0000-0000-000000000000");
      }
      break;
  }

  // Tri
  if (sortBy === "date_asc") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: rows } = await query;

  // ── Transformation ───────────────────────────────────────────
  type Row = {
    status: string;
    responded_at: string | null;
    quote_requests: (QuoteRequest & {
      users: { first_name: string | null; last_name: string | null } | null;
      companies: { name: string } | null;
      quotes: { status: string; caterer_id: string }[] | null;
    }) | null;
  };

  let requests = (rows ?? [])
    .map((row) => {
      const r = row as Row;
      if (!r.quote_requests) return null;

      const qr = r.quote_requests;
      const u = qr.users;
      const quoteStatus = (qr.quotes ?? []).find(
        (q) => q.caterer_id === catererId
      )?.status ?? null;

      return {
        ...qr,
        client_name: u
          ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
          : undefined,
        company_name: qr.companies?.name ?? undefined,
        is_new: r.status === "selected",
        qrc_status: r.status,
        quote_status: quoteStatus,
      };
    })
    .filter(Boolean) as Array<Parameters<typeof RequestCard>[0]["request"] & { qrc_status: string }>;

  // Recherche textuelle (titre ou adresse)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    requests = requests.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.event_address.toLowerCase().includes(q)
    );
  }

  return (
    <main
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}
    >
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          {/* Titre */}
          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Liste des demandes
          </h1>

          {/* Barre filtres + recherche */}
          <Suspense>
            <FilterTabs activeFilter={activeFilter} searchQuery={searchQuery} />
          </Suspense>

          {/* Liste */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-6">

            {/* Header liste */}
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
                  <span className="font-bold text-navy">
                    {sortBy === "date_asc" ? "Date croissante" : "Date décroissante"}
                  </span>
                </span>
                <ChevronDown size={18} className="text-navy" />
              </div>
            </div>

            {/* Cards */}
            {requests.length === 0 ? (
              <div className="py-12 text-center">
                <p
                  className="text-sm text-gray-medium"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  Aucune demande{activeFilter !== "all" ? " dans cette catégorie" : ""}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[#F3F4F6]">
                {requests.map((req) => (
                  <RequestCard key={req.id} request={req} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
