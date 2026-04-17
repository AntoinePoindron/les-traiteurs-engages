"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { geocodeAddress } from "@/lib/geocoding";
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

/**
 * Updates an existing quote request. Only allowed while the request is in a
 * pre-quote state ("awaiting_quotes" variant, i.e. status in {pending_review,
 * approved, sent_to_caterers} and no quote has been received yet).
 *
 * Ownership is enforced both here (explicit check) and by RLS policies on
 * the quote_requests table.
 */
export async function updateQuoteRequest(
  requestId: string,
  data: WizardData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  // ── Fetch current request to check permissions and status ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRaw } = await (supabase as any)
    .from("quote_requests")
    .select("id, client_user_id, company_id, status, event_address, quotes ( id )")
    .eq("id", requestId)
    .single();

  const existing = existingRaw as {
    id: string;
    client_user_id: string;
    company_id: string;
    status: string;
    event_address: string;
    quotes: { id: string }[] | null;
  } | null;

  if (!existing) return { ok: false, error: "Demande introuvable" };

  // Ownership: either the user who created it, or a client_admin of the same company
  const isOwner = existing.client_user_id === user.id;
  let isCompanyAdmin = false;
  if (!isOwner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single();
    const p = profile as { role: string; company_id: string | null } | null;
    isCompanyAdmin = p?.role === "client_admin" && p.company_id === existing.company_id;
  }
  if (!isOwner && !isCompanyAdmin) {
    return { ok: false, error: "Non autorisé" };
  }

  // Status must allow editing (pre-quote states, no quote received yet)
  const editableStatuses = ["pending_review", "approved", "sent_to_caterers"];
  const hasQuotes = Array.isArray(existing.quotes) && existing.quotes.length > 0;
  if (!editableStatuses.includes(existing.status) || hasQuotes) {
    return { ok: false, error: "Cette demande ne peut plus être modifiée" };
  }

  // ── Build update payload (same shape as insert in new/actions.ts) ──

  const guestCount = parseInt(data.guestCount) || 1;
  const title = `${serviceTypeLabel(data.serviceType)} – ${data.eventDate}`;

  const updatePayload: Record<string, unknown> = {
    title,
    company_service_id: data.companyServiceId || null,
    event_date:       data.eventDate,
    event_start_time: data.eventStartTime || null,
    event_end_time:   data.eventEndTime || null,
    event_address:    data.eventAddress,
    guest_count:      guestCount,
    description:      data.eventDescription || null,
    meal_type:             toMealType(data.serviceType),
    service_type:          data.serviceType,
    is_full_day:           data.isFullDay,
    service_type_secondary: data.isFullDay && data.serviceTypeSecondary ? data.serviceTypeSecondary : null,
    meal_type_secondary:   data.isFullDay && data.serviceTypeSecondary
                             ? toMealType(data.serviceTypeSecondary)
                             : null,
    dietary_vegetarian:       data.dietVegetarian,
    dietary_vegetarian_count: data.dietVegetarian && data.dietVegetarianCount ? parseInt(data.dietVegetarianCount) : null,
    dietary_halal:            data.dietHalal,
    dietary_gluten_free:      data.dietGlutenFree,
    dietary_gluten_free_count: data.dietGlutenFree && data.dietGlutenFreeCount ? parseInt(data.dietGlutenFreeCount) : null,
    dietary_bio:              data.dietBio,
    dietary_other:            data.dietOther || null,
    drinks_included:          data.drinksWaterStill || data.drinksWaterSparkling || data.drinksSoft || data.drinksAlcohol || data.drinksHot,
    drinks_water_still:       data.drinksWaterStill,
    drinks_water_sparkling:   data.drinksWaterSparkling,
    drinks_soft:              data.drinksSoft,
    drinks_soft_details:      data.drinksSoftDetails || null,
    drinks_alcohol:           data.drinksAlcohol,
    drinks_alcohol_details:   data.drinksAlcoholDetails || null,
    drinks_hot:               data.drinksHot,
    service_waitstaff:        data.serviceWaitstaff,
    service_equipment:        data.serviceEquipment,
    service_equipment_verres: data.serviceEquipmentVerres,
    service_equipment_nappes: data.serviceEquipmentNappes,
    service_equipment_tables: data.serviceEquipmentTables,
    service_equipment_other:  data.serviceEquipmentOther || null,
    service_setup:            data.serviceSetup,
    service_setup_time:       data.serviceSetupTime || null,
    service_setup_other:      data.serviceSetupOther || null,
    budget_global:       data.budgetGlobal ? parseFloat(data.budgetGlobal) : null,
    budget_per_person:   data.budgetPerPerson ? parseFloat(data.budgetPerPerson) : null,
    budget_flexibility:  data.budgetFlexibility || null,
    message_to_caterer: data.messageToCaterer || null,
  };

  // Re-geocode only if address changed
  if (data.eventAddress !== existing.event_address) {
    const coords = await geocodeAddress({ address: data.eventAddress });
    updatePayload.event_latitude  = coords?.lat ?? null;
    updatePayload.event_longitude = coords?.lng ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from("quote_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select("id");

  const err = error as { message: string } | null;
  if (err) return { ok: false, error: err.message };

  // If no rows came back, the UPDATE was silently blocked by RLS. This
  // means the policy doesn't allow this edit — likely a missing migration.
  if (!Array.isArray(updated) || updated.length === 0) {
    return {
      ok: false,
      error: "Modification bloquée par les permissions de la base. Vérifie que la migration 021 a bien été appliquée.",
    };
  }

  revalidatePath(`/client/requests/${requestId}`);
  revalidatePath("/client/requests");
  revalidatePath("/client/dashboard");
  // Admin side: the qualification page recomputes caterer matching from
  // the request's fields, so any content edit can change the result
  // (e.g. new address brings matching caterers into range).
  revalidatePath(`/admin/qualification/${requestId}`);
  revalidatePath("/admin/qualification");

  return { ok: true };
}
