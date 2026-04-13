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

  // ── Requête Supabase selon le filtre actif ──────────────────
  let query = supabase
    .from("quote_request_caterers")
    .select(`
      id,
      status,
      responded_at,
      quote_requests (
        id, title, event_date, event_address,
        guest_count, budget_global, meal_type,
        users ( first_name, last_name )
      ),
      quotes ( status )
    `)
    .eq("caterer_id", catererId ?? "");

  // Filtrage par statut
  switch (activeFilter) {
    case "new":
      query = query.eq("status", "selected");
      break;
    case "sent":
    case "pending":
      query = query.in("status", ["responded", "transmitted_to_client"]);
      break;
    case "archived":
      query = query.eq("status", "rejected");
      break;
    // "accepted" et "refused" : filtre sur le devis associé (géré côté JS après fetch)
  }

  // Tri
  if (sortBy === "date_asc") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: rows } = await query;

  // ── Transformation + filtres complémentaires ────────────────
  type Row = {
    id: string;
    status: string;
    responded_at: string | null;
    quote_requests: (QuoteRequest & {
      users: { first_name: string | null; last_name: string | null } | null;
    }) | null;
    quotes: { status: string }[] | null;
  };

  let requests = (rows ?? [])
    .map((row) => {
      const r = row as Row;
      if (!r.quote_requests) return null;

      const qr = r.quote_requests;
      const quoteStatus = Array.isArray(r.quotes) && r.quotes.length > 0
        ? r.quotes[0].status
        : null;

      // Filtre accepté / refusé basé sur le statut du devis
      if (activeFilter === "accepted" && quoteStatus !== "accepted") return null;
      if (activeFilter === "refused" && quoteStatus !== "refused") return null;

      const u = qr.users;
      return {
        ...qr,
        client_name: u
          ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
          : undefined,
        is_new: r.status === "selected",
      };
    })
    .filter(Boolean) as Array<Parameters<typeof RequestCard>[0]["request"]>;

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
              <div className="flex flex-col gap-4">
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
