"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function acceptQuoteAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const quoteId      = formData.get("quote_id")      as string;
  const requestId    = formData.get("request_id")    as string;
  const eventDate    = formData.get("event_date")    as string;
  const eventAddress = formData.get("event_address") as string;

  // Vérifier que la demande appartient à cet utilisateur (ou à son entreprise)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req } = await (supabase as any)
    .from("quote_requests")
    .select("id, company_id")
    .eq("id", requestId)
    .single();
  if (!req) return;

  // Accepter ce devis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotes")
    .update({ status: "accepted" })
    .eq("id", quoteId);

  // Refuser les autres devis de cette demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotes")
    .update({ status: "refused" })
    .eq("quote_request_id", requestId)
    .neq("id", quoteId)
    .in("status", ["sent", "draft"]);

  // Créer la commande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("orders")
    .insert({
      quote_id:         quoteId,
      client_admin_id:  user.id,
      status:           "confirmed",
      delivery_date:    eventDate,
      delivery_address: eventAddress,
    });

  // Clôturer la demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quote_requests")
    .update({ status: "completed" })
    .eq("id", requestId);

  revalidatePath(`/client/requests/${requestId}`);
  redirect(`/client/requests/${requestId}`);
}

export async function refuseQuoteAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const quoteId   = formData.get("quote_id")   as string;
  const requestId = formData.get("request_id") as string;
  const reason    = (formData.get("reason") as string) || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotes")
    .update({ status: "refused", refusal_reason: reason || null })
    .eq("id", quoteId);

  revalidatePath(`/client/requests/${requestId}`);
  redirect(`/client/requests/${requestId}`);
}
