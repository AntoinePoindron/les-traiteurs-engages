import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QuoteEditor from "@/components/caterer/QuoteEditor";
import type { QuoteRequest } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string; quoteId: string }>;
}

export default async function QuoteEditPage({ params }: PageProps) {
  const { id, quoteId } = await params;
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

  // Fetch the draft quote (must belong to this caterer)
  const { data: quoteData } = await supabase
    .from("quotes")
    .select("id, reference, valid_until, notes, details, status")
    .eq("id", quoteId)
    .eq("caterer_id", catererId)
    .eq("status", "draft")
    .single();

  if (!quoteData) notFound();

  // Fetch the quote request
  const { data: requestData } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!requestData) notFound();

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

  // Infos client pour l'en-tête de la preview
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = requestData as any;
  const [{ data: companyData }, { data: clientUserData }] = await Promise.all([
    req.company_id
      ? supabase
          .from("companies")
          .select("name, siret, address, city, zip_code")
          .eq("id", req.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    req.client_user_id
      ? supabase
          .from("users")
          .select("first_name, last_name, email")
          .eq("id", req.client_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const co = companyData as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cu = clientUserData as any;
  const clientInfo = {
    companyName: co?.name ?? null,
    contactName:
      cu?.first_name || cu?.last_name
        ? `${cu?.first_name ?? ""} ${cu?.last_name ?? ""}`.trim() || null
        : null,
    email: cu?.email ?? null,
    siret: co?.siret ?? null,
    address: [co?.address, co?.zip_code, co?.city].filter(Boolean).join(", ") || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quoteData as any;

  return (
    <QuoteEditor
      request={requestData as QuoteRequest}
      requestId={id}
      defaultReference={q.reference ?? ""}
      catererInfo={catererInfo}
      clientInfo={clientInfo}
      draftQuote={{
        id: q.id,
        reference: q.reference ?? "",
        valid_until: q.valid_until ?? null,
        notes: q.notes ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: (q.details ?? []) as any[],
      }}
    />
  );
}
