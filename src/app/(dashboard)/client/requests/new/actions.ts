"use server";

import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocoding";
import { notifySuperAdmins } from "@/lib/notifications";
import type { WizardData } from "@/components/client/RequestWizard";

// Maps wizard service type keys to the legacy meal_type enum
function toMealType(serviceType: string) {
  const map: Record<string, string> = {
    petit_dejeuner:        "petit_dejeuner",
    pause_gourmande:       "dejeuner",
    plateaux_repas:        "dejeuner",
    cocktail_dinatoire:    "cocktail",
    cocktail_dejeunatoire: "cocktail",
    cocktail_aperitif:     "cocktail",
  };
  return map[serviceType] ?? "autre";
}

function serviceTypeLabel(key: string): string {
  const labels: Record<string, string> = {
    petit_dejeuner:        "Petit déjeuner",
    pause_gourmande:       "Pause gourmande",
    plateaux_repas:        "Plateaux repas",
    cocktail_dinatoire:    "Cocktail dinatoire",
    cocktail_dejeunatoire: "Cocktail déjeunatoire",
    cocktail_aperitif:     "Cocktail apéritif",
  };
  return labels[key] ?? key;
}

export async function submitQuoteRequest(
  data: WizardData,
  catererIdParam: string | null,
  isCompareMode: boolean
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single() as { data: { company_id: string } | null };
  if (!profile?.company_id) throw new Error("Entreprise introuvable");

  const guestCount = parseInt(data.guestCount) || 1;
  const title = `${serviceTypeLabel(data.serviceType)} – ${data.eventDate}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("quote_requests")
    .insert({
      title,
      client_user_id:   user.id,
      company_id:       profile.company_id,
      // Service interne de l'entreprise (pour le suivi des dépenses)
      company_service_id: data.companyServiceId || null,
      // Event
      event_date:       data.eventDate,
      event_start_time: data.eventStartTime || null,
      event_end_time:   data.eventEndTime || null,
      event_address:    data.eventAddress,
      event_zip_code:   data.eventZipCode || null,
      event_city:       data.eventCity || null,
      guest_count:      guestCount,
      description:      data.eventDescription || null,
      // Service type
      meal_type:             toMealType(data.serviceType) as never,
      service_type:          data.serviceType,
      is_full_day:           data.isFullDay,
      service_type_secondary: data.isFullDay && data.serviceTypeSecondary ? data.serviceTypeSecondary : null,
      meal_type_secondary:   data.isFullDay && data.serviceTypeSecondary
                               ? toMealType(data.serviceTypeSecondary) as never
                               : null,
      // Dietary
      dietary_vegetarian:       data.dietVegetarian,
      dietary_vegetarian_count: data.dietVegetarian && data.dietVegetarianCount ? parseInt(data.dietVegetarianCount) : null,
      dietary_halal:            data.dietHalal,
      dietary_gluten_free:      data.dietGlutenFree,
      dietary_gluten_free_count: data.dietGlutenFree && data.dietGlutenFreeCount ? parseInt(data.dietGlutenFreeCount) : null,
      dietary_bio:              data.dietBio,
      dietary_other:            data.dietOther || null,
      dietary_vegan:            false,
      dietary_kosher:           false,
      // Drinks
      drinks_included:          data.drinksWaterStill || data.drinksWaterSparkling || data.drinksSoft || data.drinksAlcohol || data.drinksHot,
      drinks_water_still:       data.drinksWaterStill,
      drinks_water_sparkling:   data.drinksWaterSparkling,
      drinks_soft:              data.drinksSoft,
      drinks_soft_details:      data.drinksSoftDetails || null,
      drinks_alcohol:           data.drinksAlcohol,
      drinks_alcohol_details:   data.drinksAlcoholDetails || null,
      drinks_hot:               data.drinksHot,
      drinks_details:           null,
      // Services
      service_waitstaff:         data.serviceWaitstaff,
      service_waitstaff_details: data.serviceWaitstaffDetails || null,
      service_equipment:         data.serviceEquipment,
      service_equipment_verres: data.serviceEquipmentVerres,
      service_equipment_nappes: data.serviceEquipmentNappes,
      service_equipment_tables: data.serviceEquipmentTables,
      service_equipment_other:  data.serviceEquipmentOther || null,
      service_setup:            data.serviceSetup,
      service_setup_time:       data.serviceSetupTime || null,
      service_setup_other:      data.serviceSetupOther || null,
      service_decoration:       false,
      service_other:            null,
      // Budget
      budget_global:       data.budgetGlobal ? parseFloat(data.budgetGlobal) : null,
      budget_per_person:   data.budgetPerPerson ? parseFloat(data.budgetPerPerson) : null,
      budget_flexibility:  data.budgetFlexibility as "none" | "5" | "10" | null,
      // Message & mode
      message_to_caterer: data.messageToCaterer || null,
      is_compare_mode:    isCompareMode,
      status:             "pending_review",
    })
    .select("id")
    .single();

  const err = error as { message: string } | null;
  if (err) throw new Error(err.message);

  const requestId = (inserted as { id: string }).id;

  // Géocoder l'adresse de l'événement (Nominatim, non bloquant). Sert
  // au matching par rayon de livraison en mode comparer-3.
  // Géocodage : on alimente les 3 parties séparément pour maximiser
  // la précision (Nominatim accepte structured input).
  const coords = await geocodeAddress({
    address: data.eventAddress,
    zipCode: data.eventZipCode,
    city:    data.eventCity,
  });
  if (coords) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("quote_requests")
      .update({
        event_latitude:  coords.lat,
        event_longitude: coords.lng,
      })
      .eq("id", requestId);
  }

  // Si un traiteur spécifique a été ciblé, l'associer à la demande
  if (catererIdParam && !isCompareMode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: qrcError } = await (supabase as any).from("quote_request_caterers").insert({
      quote_request_id: requestId,
      caterer_id:       catererIdParam,
      status:           "selected",
    });
    const qrcErr = qrcError as { message: string } | null;
    if (qrcErr) throw new Error(`Liaison traiteur échouée : ${qrcErr.message}`);

    // La demande est directement transmise au traiteur → passer en sent_to_caterers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("quote_requests")
      .update({ status: "sent_to_caterers" })
      .eq("id", requestId);
  }

  // ── Notifier les super-admins qu'une nouvelle demande est à qualifier ─
  // Uniquement en mode compare-3 (les demandes directes vers un traiteur
  // ciblé n'ont pas besoin de qualif admin). En mode direct le qrc est
  // déjà créé juste au-dessus et le traiteur a été notifié via la
  // trigger sur quote_request_caterers (ou le sera quand on branchera
  // un trigger DB). Le super-admin n'a pas à arbitrer.
  if (isCompareMode) {
    await notifySuperAdmins({
      type: "new_request_to_qualify",
      title: "Nouvelle demande à qualifier",
      body: `${title} — à dispatcher auprès des traiteurs adaptés.`,
      relatedEntityType: "quote_request",
      relatedEntityId: requestId,
    });
  }

  return { id: requestId };
}
