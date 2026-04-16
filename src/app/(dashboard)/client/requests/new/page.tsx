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

  let catererData: {
    id: string;
    name: string;
    service_config: Record<string, ServiceTypeConfig>;
  } | null = null;

  if (caterer_id && !isCompareMode) {
    const supabase = await createClient();
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

  return (
    <RequestWizard
      catererData={catererData}
      isCompareMode={isCompareMode}
    />
  );
}
