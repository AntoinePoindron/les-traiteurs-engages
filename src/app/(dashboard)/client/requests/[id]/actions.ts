"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications";

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

  // ── Notifier le traiteur que son devis a été accepté ──────────
  // On récupère le caterer owner du quote via la table quotes (caterer_id)
  // puis on remonte à un user_id destinataire. Choix : on notifie tous les
  // users du traiteur (role=caterer, caterer_id=...). En pratique il y en a
  // un seul au MVP.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quoteOwner } = await (supabase as any)
    .from("quotes")
    .select("caterer_id, reference, caterers(name)")
    .eq("id", quoteId)
    .single();

  const catererIdOwner = (quoteOwner as { caterer_id: string } | null)?.caterer_id;
  const quoteRef       = (quoteOwner as { reference: string | null } | null)?.reference ?? null;

  if (catererIdOwner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catererUsers } = await (supabase as any)
      .from("users")
      .select("id")
      .eq("caterer_id", catererIdOwner)
      .eq("role", "caterer");

    for (const cu of (catererUsers ?? []) as { id: string }[]) {
      await createNotification({
        userId: cu.id,
        type: "quote_accepted",
        title: "Votre devis a été accepté",
        body: quoteRef
          ? `Le client a accepté votre devis ${quoteRef}. Une nouvelle commande est en attente de prestation.`
          : "Le client a accepté votre devis. Une nouvelle commande est en attente de prestation.",
        relatedEntityType: "order",
        relatedEntityId: orderId ?? null,
      });
    }
  }

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

  // ── Notifier le traiteur que son devis a été refusé ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quoteOwner } = await (supabase as any)
    .from("quotes")
    .select("caterer_id, reference")
    .eq("id", quoteId)
    .single();

  const catererIdOwner = (quoteOwner as { caterer_id: string } | null)?.caterer_id;
  const quoteRef       = (quoteOwner as { reference: string | null } | null)?.reference ?? null;

  if (catererIdOwner) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catererUsers } = await (supabase as any)
      .from("users")
      .select("id")
      .eq("caterer_id", catererIdOwner)
      .eq("role", "caterer");

    for (const cu of (catererUsers ?? []) as { id: string }[]) {
      await createNotification({
        userId: cu.id,
        type: "quote_refused",
        title: "Votre devis a été refusé",
        body: quoteRef
          ? `Le client n'a pas retenu votre devis ${quoteRef}${reason ? ` — motif : ${reason}` : "."}`
          : `Le client n'a pas retenu votre devis${reason ? ` — motif : ${reason}` : "."}`,
        // IMPORTANT : on référence la demande (quote_request), pas le
        // devis lui-même, sinon le dismissal sur la page détail de la
        // demande côté traiteur ne matche pas (elle cherche par
        // request_id). Ça rend aussi le href de la notif plus utile —
        // cliquer ramène sur la demande et ses devis.
        relatedEntityType: "quote_request",
        relatedEntityId: requestId,
      });
    }
  }

  revalidatePath(`/client/requests/${requestId}`);
  redirect(`/client/requests/${requestId}`);
}
