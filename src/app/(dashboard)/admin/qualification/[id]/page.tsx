import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import StatusBadge from "@/components/ui/StatusBadge";
import CatererSelector from "./CatererSelector";
import type { Caterer, ServiceTypeConfig } from "@/types/database";

const SERVICE_LABELS: Record<string, string> = {
  petit_dejeuner: "Petit déjeuner", pause_gourmande: "Pause gourmande",
  plateaux_repas: "Plateaux repas", cocktail_dinatoire: "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire", cocktail_aperitif: "Cocktail apéritif",
  dejeuner: "Déjeuner", diner: "Dîner", cocktail: "Cocktail", autre: "Autre",
};

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminQualificationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Admin connecté ───────────────────────────────────────────
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  const adminUserId = adminUser!.id;

  // ── Demande ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqData } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, client_user_id, title, status, event_date, event_start_time, event_end_time,
      event_address, guest_count, service_type, meal_type,
      budget_global, budget_per_person, budget_flexibility,
      dietary_vegetarian, dietary_halal, dietary_gluten_free, dietary_bio,
      drinks_alcohol, service_waitstaff, service_equipment,
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

  // ── Traiteurs validés ────────────────────────────────────────
  const { data: caterersData } = await supabase
    .from("caterers")
    .select("id, name, city, logo_url, esat_status, dietary_vegetarian, dietary_halal, dietary_gluten_free, dietary_bio, service_config, capacity_min, capacity_max, description, delivery_radius_km, specialties, address, zip_code")
    .eq("is_validated", true)
    .order("name");

  const caterers = (caterersData ?? []) as Caterer[];

  // ── Calcul des correspondances ───────────────────────────────
  const serviceKey = req.service_type || req.meal_type || "";
  const hasActiveDietary = req.dietary_vegetarian || req.dietary_halal || req.dietary_gluten_free;

  const scoredCaterers = caterers
    .map((cat) => {
      const cfg = (cat.service_config as Record<string, ServiceTypeConfig>)[serviceKey];
      const serviceOk   = !!cfg?.enabled;
      const capacityOk  = !cfg?.capacity_min && !cfg?.capacity_max
        ? true
        : (req.guest_count >= (cfg?.capacity_min ?? 0) && req.guest_count <= (cfg?.capacity_max ?? 99999));
      const vegetarianOk = !req.dietary_vegetarian || cat.dietary_vegetarian;
      const halalOk      = !req.dietary_halal      || cat.dietary_halal;
      const glutenFreeOk = !req.dietary_gluten_free || cat.dietary_gluten_free;

      const criteria = [serviceOk, capacityOk, vegetarianOk, halalOk, glutenFreeOk];
      const score = criteria.filter(Boolean).length;
      const scorePercent = Math.round((score / criteria.length) * 100);

      return {
        id:               cat.id,
        name:             cat.name,
        city:             cat.city,
        logo_url:         cat.logo_url,
        esat_status:      cat.esat_status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description:      (cat as any).description ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delivery_radius_km: (cat as any).delivery_radius_km ?? null,
        capacity_min:     cat.capacity_min ?? null,
        capacity_max:     cat.capacity_max ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        specialties:      (cat as any).specialties ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        address:          (cat as any).address ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zip_code:         (cat as any).zip_code ?? null,
        match: { service: serviceOk, capacity: capacityOk, vegetarian: vegetarianOk, halal: halalOk, glutenFree: glutenFreeOk, score },
        scorePercent,
      };
    })
    .sort((a, b) => b.match.score - a.match.score);

  // ── Thread existant entre admin et client pour cette demande ─
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
  const serviceKey2 = req.service_type || req.meal_type || "";
  const serviceLabel = SERVICE_LABELS[serviceKey2] || serviceKey2 || "—";

  const user = req.users;
  const contactName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
    : null;

  const clientUserId: string | null = req.users?.id ?? req.client_user_id ?? null;
  const clientName = contactName ?? req.users?.email ?? "le demandeur";

  // RequestData shape for CatererSelector
  const reqForSelector = {
    id:                   req.id,
    event_date:           req.event_date,
    event_start_time:     req.event_start_time,
    event_end_time:       req.event_end_time,
    event_address:        req.event_address,
    guest_count:          req.guest_count,
    service_type:         req.service_type,
    meal_type:            req.meal_type,
    budget_global:        req.budget_global,
    budget_per_person:    req.budget_per_person,
    budget_flexibility:   req.budget_flexibility,
    dietary_vegetarian:   req.dietary_vegetarian,
    dietary_halal:        req.dietary_halal,
    dietary_gluten_free:  req.dietary_gluten_free,
    dietary_bio:          req.dietary_bio,
    description:          req.description,
    message_to_caterer:   req.message_to_caterer,
    super_admin_notes:    req.super_admin_notes,
    companies:            req.companies ?? null,
  };

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton label="Retour à la file" />

          {/* Titre */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {req.title}
              </h1>
              <p className="text-sm text-[#9CA3AF] mt-1" style={mFont}>
                Déposée le {new Date(req.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="shrink-0">
              {isAlreadySent && <StatusBadge variant="awaiting_quotes" customLabel="Envoyée aux traiteurs" />}
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

          {/* Two-column layout owned by CatererSelector */}
          <CatererSelector
            req={reqForSelector}
            serviceLabel={serviceLabel}
            eventDate={eventDate}
            isAlreadySent={isAlreadySent}
            isCancelled={isCancelled}
            caterers={scoredCaterers}
            hasActiveDietary={hasActiveDietary}
            requestId={id}
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
