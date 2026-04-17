import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import RequestWizard, { type WizardData } from "@/components/client/RequestWizard";
import type { ServiceTypeConfig } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

const EDITABLE_STATUSES = ["pending_review", "approved", "sent_to_caterers"];

export default async function EditRequestPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fetch the existing request with all fields needed by WizardData ──

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requestRaw } = await (supabase as any)
    .from("quote_requests")
    .select(`
      id, status, client_user_id, company_id, company_service_id,
      is_compare_mode,
      event_date, event_start_time, event_end_time, event_address,
      guest_count, description,
      service_type, is_full_day, service_type_secondary,
      dietary_vegetarian, dietary_vegetarian_count,
      dietary_halal, dietary_gluten_free, dietary_gluten_free_count,
      dietary_bio, dietary_other,
      drinks_water_still, drinks_water_sparkling,
      drinks_soft, drinks_soft_details,
      drinks_alcohol, drinks_alcohol_details,
      drinks_hot,
      service_waitstaff, service_equipment,
      service_equipment_verres, service_equipment_nappes,
      service_equipment_tables, service_equipment_other,
      service_setup, service_setup_time, service_setup_other,
      budget_global, budget_per_person, budget_flexibility,
      message_to_caterer,
      quotes ( id ),
      quote_request_caterers ( caterer_id, caterers ( id, name, service_config ) )
    `)
    .eq("id", id)
    .single();

  const request = requestRaw as {
    id: string;
    status: string;
    client_user_id: string;
    company_id: string;
    company_service_id: string | null;
    is_compare_mode: boolean;
    event_date: string | null;
    event_start_time: string | null;
    event_end_time: string | null;
    event_address: string | null;
    guest_count: number | null;
    description: string | null;
    service_type: string | null;
    is_full_day: boolean | null;
    service_type_secondary: string | null;
    dietary_vegetarian: boolean | null;
    dietary_vegetarian_count: number | null;
    dietary_halal: boolean | null;
    dietary_gluten_free: boolean | null;
    dietary_gluten_free_count: number | null;
    dietary_bio: boolean | null;
    dietary_other: string | null;
    drinks_water_still: boolean | null;
    drinks_water_sparkling: boolean | null;
    drinks_soft: boolean | null;
    drinks_soft_details: string | null;
    drinks_alcohol: boolean | null;
    drinks_alcohol_details: string | null;
    drinks_hot: boolean | null;
    service_waitstaff: boolean | null;
    service_equipment: boolean | null;
    service_equipment_verres: boolean | null;
    service_equipment_nappes: boolean | null;
    service_equipment_tables: boolean | null;
    service_equipment_other: string | null;
    service_setup: boolean | null;
    service_setup_time: string | null;
    service_setup_other: string | null;
    budget_global: number | null;
    budget_per_person: number | null;
    budget_flexibility: string | null;
    message_to_caterer: string | null;
    quotes: { id: string }[] | null;
    quote_request_caterers: {
      caterer_id: string;
      caterers: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null;
    }[] | null;
  } | null;

  if (!request) notFound();

  // ── Check ownership and status ──────────────────────────────

  const isOwner = request.client_user_id === user.id;
  let isCompanyAdmin = false;
  if (!isOwner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .single();
    const p = profile as { role: string; company_id: string | null } | null;
    isCompanyAdmin = p?.role === "client_admin" && p.company_id === request.company_id;
  }
  if (!isOwner && !isCompanyAdmin) redirect(`/client/requests/${id}`);

  const hasQuotes = Array.isArray(request.quotes) && request.quotes.length > 0;
  if (!EDITABLE_STATUSES.includes(request.status) || hasQuotes) {
    redirect(`/client/requests/${id}`);
  }

  // ── Map DB fields to WizardData ─────────────────────────────

  const initialData: WizardData = {
    // Step 1
    serviceType: request.service_type ?? "",
    isFullDay: request.is_full_day ?? false,
    serviceTypeSecondary: request.service_type_secondary ?? "",
    // Step 2
    eventDate: request.event_date ?? "",
    eventStartTime: request.event_start_time ?? "",
    eventEndTime: request.event_end_time ?? "",
    eventAddress: request.event_address ?? "",
    guestCount: request.guest_count ? String(request.guest_count) : "",
    eventDescription: request.description ?? "",
    companyServiceId: request.company_service_id ?? "",
    // Step 3
    dietVegetarian: request.dietary_vegetarian ?? false,
    dietVegetarianCount: request.dietary_vegetarian_count ? String(request.dietary_vegetarian_count) : "",
    dietHalal: request.dietary_halal ?? false,
    dietGlutenFree: request.dietary_gluten_free ?? false,
    dietGlutenFreeCount: request.dietary_gluten_free_count ? String(request.dietary_gluten_free_count) : "",
    dietBio: request.dietary_bio ?? false,
    dietOther: request.dietary_other ?? "",
    // Step 4
    drinksWaterStill: request.drinks_water_still ?? false,
    drinksWaterSparkling: request.drinks_water_sparkling ?? false,
    drinksSoft: request.drinks_soft ?? false,
    drinksSoftDetails: request.drinks_soft_details ?? "",
    drinksAlcohol: request.drinks_alcohol ?? false,
    drinksAlcoholDetails: request.drinks_alcohol_details ?? "",
    drinksHot: request.drinks_hot ?? false,
    // Step 5
    serviceWaitstaff: request.service_waitstaff ?? false,
    serviceEquipment: request.service_equipment ?? false,
    serviceEquipmentVerres: request.service_equipment_verres ?? false,
    serviceEquipmentNappes: request.service_equipment_nappes ?? false,
    serviceEquipmentTables: request.service_equipment_tables ?? false,
    serviceEquipmentOther: request.service_equipment_other ?? "",
    serviceSetup: request.service_setup ?? false,
    serviceSetupTime: request.service_setup_time ?? "",
    serviceSetupOther: request.service_setup_other ?? "",
    // Step 6
    budgetGlobal: request.budget_global != null ? String(request.budget_global) : "",
    budgetPerPerson: request.budget_per_person != null ? String(request.budget_per_person) : "",
    budgetFlexibility: request.budget_flexibility ?? "10",
    // Step 7
    messageToCaterer: request.message_to_caterer ?? "",
  };

  // ── Caterer data (for direct mode) ──────────────────────────

  let catererData: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null = null;
  if (!request.is_compare_mode && request.quote_request_caterers && request.quote_request_caterers.length > 0) {
    const c = request.quote_request_caterers[0].caterers;
    if (c) {
      catererData = {
        id: c.id,
        name: c.name,
        service_config: (c.service_config ?? {}) as Record<string, ServiceTypeConfig>,
      };
    }
  }

  // ── Company services (for the dropdown in Step 2) ──────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: servicesRaw } = await (supabase as any)
    .from("company_services")
    .select("id, name")
    .eq("company_id", request.company_id)
    .order("name");
  const companyServices = (servicesRaw ?? []) as { id: string; name: string }[];

  return (
    <RequestWizard
      catererData={catererData}
      isCompareMode={request.is_compare_mode}
      companyServices={companyServices}
      editRequestId={id}
      initialData={initialData}
    />
  );
}
