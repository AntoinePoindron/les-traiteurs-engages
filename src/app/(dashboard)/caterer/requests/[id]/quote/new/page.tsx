import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QuoteEditor from "@/components/caterer/QuoteEditor";
import type { QuoteRequest } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuoteNewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profileData } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user.id)
    .single();

  const catererId = (
    profileData as { caterer_id: string | null } | null
  )?.caterer_id;
  if (!catererId) notFound();

  // Verify caterer is assigned to this request
  const { data: assignment } = await supabase
    .from("quote_request_caterers")
    .select("status")
    .eq("caterer_id", catererId)
    .eq("quote_request_id", id)
    .single();

  if (!assignment) notFound();

  const { data: requestData } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!requestData) notFound();

  // Generate default reference from existing quote count
  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("caterer_id", catererId);

  const year = new Date().getFullYear();
  const defaultReference = `DEVIS-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  // Fetch caterer info for PDF preview
  const { data: catererData } = await supabase
    .from("caterers")
    .select("name, address, city, zip_code, siret, logo_url")
    .eq("id", catererId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = catererData as any;
  const catererInfo = {
    name: c?.name ?? "",
    address: c?.address ?? null,
    city: c?.city ?? null,
    zip_code: c?.zip_code ?? null,
    siret: c?.siret ?? null,
    logo_url: c?.logo_url ?? null,
  };

  return (
    <QuoteEditor
      request={requestData as QuoteRequest}
      requestId={id}
      defaultReference={defaultReference}
      catererInfo={catererInfo}
    />
  );
}
