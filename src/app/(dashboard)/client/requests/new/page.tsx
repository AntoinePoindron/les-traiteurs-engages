import { createClient } from "@/lib/supabase/server";
import RequestWizard from "@/components/client/RequestWizard";
import type { ServiceTypeConfig } from "@/types/database";

type SearchParams = Promise<{ caterer_id?: string; mode?: string }>;

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { caterer_id, mode } = await searchParams;
  const isCompareMode = mode === "compare";

  const supabase = await createClient();

  let catererData: {
    id: string;
    name: string;
    service_config: Record<string, ServiceTypeConfig>;
  } | null = null;

  if (caterer_id && !isCompareMode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("caterers")
      .select("id, name, service_config")
      .eq("id", caterer_id)
      .single() as { data: { id: string; name: string; service_config: Record<string, ServiceTypeConfig> } | null };
    if (data) {
      catererData = {
        id:             data.id,
        name:           data.name,
        service_config: (data.service_config ?? {}) as Record<string, ServiceTypeConfig>,
      };
    }
  }

  // Services internes de la company de l'utilisateur (pour rattacher la dépense)
  const { data: { user } } = await supabase.auth.getUser();
  let companyServices: { id: string; name: string }[] = [];
  let defaultCompanyServiceId: string | null = null;

  if (user) {
    const { data: profileData } = await supabase
      .from("users")
      .select("company_id, role")
      .eq("id", user.id)
      .single();
    const profile = profileData as { company_id: string | null; role: string } | null;
    const companyId = profile?.company_id ?? null;

    if (companyId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: servicesRaw } = await (supabase as any)
        .from("company_services")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      companyServices = servicesRaw ?? [];

      // Pré-remplir avec le service du collaborateur courant
      // (le client_admin n'est pas rattaché à un service par défaut).
      if (profile?.role !== "client_admin" && user.email) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: empRow } = await (supabase as any)
          .from("company_employees")
          .select("service_id")
          .eq("company_id", companyId)
          .eq("email", user.email)
          .maybeSingle();
        defaultCompanyServiceId = (empRow as { service_id: string | null } | null)?.service_id ?? null;
      }
    }
  }

  return (
    <RequestWizard
      catererData={catererData}
      isCompareMode={isCompareMode}
      companyServices={companyServices}
      defaultCompanyServiceId={defaultCompanyServiceId}
    />
  );
}
