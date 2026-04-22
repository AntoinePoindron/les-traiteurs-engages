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

  // Fetch caterer info for PDF preview + invoice_prefix (utilisé dans la
  // ref par défaut → garantit l'unicité cross-caterer des refs, et donc
  // des numéros de facture Stripe dérivés en FAC-…).
  const { data: catererData } = await supabase
    .from("caterers")
    .select("name, address, city, zip_code, siret, logo_url, invoice_prefix")
    .eq("id", catererId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prefix = (catererData as any)?.invoice_prefix ?? "";
  const year = new Date().getFullYear();
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const defaultReference = prefix
    ? `DEVIS-${prefix}-${year}-${seq}`
    : `DEVIS-${year}-${seq}`;

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

  // Client (entreprise + contact) — affiché sur le devis envoyé. On lit
  // la company de la demande + l'utilisateur qui l'a créée, via 2 requêtes
  // simples (les jointures Supabase ici seraient inutilement fragiles).
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

  return (
    <QuoteEditor
      request={requestData as QuoteRequest}
      requestId={id}
      defaultReference={defaultReference}
      catererInfo={catererInfo}
      clientInfo={clientInfo}
    />
  );
}
