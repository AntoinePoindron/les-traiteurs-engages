import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import CompareRequestApproval from "./CompareRequestApproval";
import { findMatchingCaterers } from "@/lib/caterer-matching";
import { formatDateTime } from "@/lib/format";

// Always re-fetch on each request. The matching algorithm depends on
// request fields that the client can edit (address, guest count, dietary),
// so we must never serve this page from a cache to avoid showing stale
// "no match" results after a client edit.
export const dynamic = "force-dynamic";

const SERVICE_LABELS: Record<string, string> = {
  petit_dejeuner: "Petit déjeuner", pause_gourmande: "Pause gourmande",
  plateaux_repas: "Plateaux repas", cocktail_dinatoire: "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire", cocktail_aperitif: "Cocktail apéritif",
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
};

const DIETARY_LABELS: Record<string, string> = {
  dietary_vegetarian:  "Végétarien",
  dietary_halal:       "Halal",
  dietary_gluten_free: "Sans gluten",
  dietary_bio:         "Bio",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminQualificationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const adminUserId = adminUser!.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqData } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, client_user_id, title, status, event_date, event_address,
      event_latitude, event_longitude,
      guest_count, service_type, meal_type,
      budget_global, budget_per_person, budget_flexibility,
      dietary_vegetarian, dietary_halal, dietary_gluten_free, dietary_bio,
      description, message_to_caterer, super_admin_notes,
      is_compare_mode, created_at,
      companies ( name, city ),
      users!client_user_id ( id, first_name, last_name, email )
    `)
    .eq("id", id)
    .eq("is_compare_mode", true)
    .single();

  if (!reqData) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = reqData as any;

  // Calcul des traiteurs matchants (même logique que l'action d'approbation)
  const matching = await findMatchingCaterers({
    meal_type:           req.meal_type,
    guest_count:         req.guest_count,
    event_latitude:      req.event_latitude,
    event_longitude:     req.event_longitude,
    dietary_vegetarian:  !!req.dietary_vegetarian,
    dietary_halal:       !!req.dietary_halal,
    dietary_gluten_free: !!req.dietary_gluten_free,
  });

  // Thread existant entre admin et client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingMsg } = await (supabase as any)
    .from("messages")
    .select("thread_id")
    .eq("quote_request_id", id)
    .limit(1)
    .maybeSingle();

  const existingThreadId: string | null = existingMsg?.thread_id ?? null;
  const isAlreadySent = req.status === "sent_to_caterers";
  const isCancelled   = req.status === "cancelled";

  const eventDate = new Date(req.event_date).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const serviceKey = req.service_type || req.meal_type || "";
  const serviceLabel = SERVICE_LABELS[serviceKey] || serviceKey || "—";

  const user = req.users;
  const contactName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
    : null;
  const clientUserId: string | null = req.users?.id ?? req.client_user_id ?? null;
  const clientName = contactName ?? req.users?.email ?? "le demandeur";

  const dietaryLabels = Object.entries(DIETARY_LABELS)
    .filter(([k]) => req[k])
    .map(([, label]) => label);

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton label="Retour à la file" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {req.title}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={mFont}>
                Déposée le {formatDateTime(req.created_at)}
              </p>
            </div>
            <div className="shrink-0">
              {isAlreadySent && <StatusBadge variant="awaiting_quotes" customLabel="Diffusée" />}
              {isCancelled   && <StatusBadge variant="cancelled" />}
              {!isAlreadySent && !isCancelled && (
                <span
                  className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold"
                  style={{ backgroundColor: "#FFF3CD", color: "#B45309", ...mFont }}
                >
                  À qualifier
                </span>
              )}
            </div>
          </div>

          <CompareRequestApproval
            requestId={id}
            serviceLabel={serviceLabel}
            eventDate={eventDate}
            eventAddress={req.event_address}
            guestCount={req.guest_count}
            companyName={req.companies?.name ?? null}
            companyCity={req.companies?.city ?? null}
            description={req.description}
            messageToClient={req.message_to_caterer}
            budgetGlobal={req.budget_global}
            budgetPerPerson={req.budget_per_person}
            dietaryLabels={dietaryLabels}
            matching={matching}
            isAlreadySent={isAlreadySent}
            isCancelled={isCancelled}
            hasEventCoords={req.event_latitude != null && req.event_longitude != null}
            adminUserId={adminUserId}
            clientUserId={clientUserId}
            clientName={clientName}
            existingThreadId={existingThreadId}
          />

        </div>
      </div>
    </main>
  );
}
