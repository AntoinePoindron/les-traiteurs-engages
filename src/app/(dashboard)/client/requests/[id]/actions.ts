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
  const { data: orderRow } = await (supabase as any)
    .from("orders")
    .insert({
      quote_id:         quoteId,
      client_admin_id:  user.id,
      status:           "confirmed",
      delivery_date:    eventDate,
      delivery_address: eventAddress,
    })
    .select("id")
    .single();

  const orderId = (orderRow as { id: string } | null)?.id;

  // Clôturer la demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quote_requests")
    .update({ status: "completed" })
    .eq("id", requestId);

  revalidatePath(`/client/requests/${requestId}`);
  // Redirect vers la page demande avec ?accepted=<orderId> pour
  // déclencher l'affichage de la modale de confirmation.
  redirect(`/client/requests/${requestId}${orderId ? `?accepted=${orderId}` : ""}`);
}

// Annule la demande côté client : refuse tous les devis reçus et
// passe le statut de la demande à "cancelled". Utilisé quand le client
// ne retient aucun des devis transmis (mode comparer-3 ou direct).
export async function cancelRequestAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const requestId = formData.get("request_id") as string;
  if (!requestId) return;

  // Refuser tous les devis 'sent' de la demande
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quotes")
    .update({ status: "refused" })
    .eq("quote_request_id", requestId)
    .eq("status", "sent");

  // Passer la demande à "cancelled"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("quote_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);

  revalidatePath(`/client/requests/${requestId}`);
  redirect(`/client/requests/${requestId}`);
}

export async function refuseQuoteAction(formData: FormData) {
  // ── Authentification ────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[refuseQuoteAction] non authentifié");
    return;
  }

  const quoteId   = formData.get("quote_id")   as string;
  const requestId = formData.get("request_id") as string;
  const reason    = (formData.get("reason") as string) || "";

  // ── Refuser le devis (RLS : seul le propriétaire peut refuser) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refused, error: refuseErr } = await (supabase as any)
    .from("quotes")
    .update({ status: "refused", refusal_reason: reason || null })
    .eq("id", quoteId)
    .eq("status", "sent")
    .select("id");

  if (refuseErr) {
    console.error("[refuseQuoteAction] update quote failed:", refuseErr);
    return;
  }
  if (!refused || refused.length === 0) {
    console.error("[refuseQuoteAction] quote non mis à jour (RLS ou status != sent)", { quoteId });
    return;
  }

  // ── S'il ne reste aucun devis 'sent' → clôturer la demande ─
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remaining, error: remErr } = await (supabase as any)
    .from("quotes")
    .select("id")
    .eq("quote_request_id", requestId)
    .eq("status", "sent");

  if (remErr) {
    console.error("[refuseQuoteAction] count remaining failed:", remErr);
  }

  if (!remaining || remaining.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updReqErr } = await (supabase as any)
      .from("quote_requests")
      .update({ status: "quotes_refused" })
      .eq("id", requestId);
    if (updReqErr) {
      console.error("[refuseQuoteAction] update request status failed:", updReqErr);
    }
  }

  revalidatePath(`/client/requests/${requestId}`);
  redirect(`/client/requests/${requestId}`);
}
