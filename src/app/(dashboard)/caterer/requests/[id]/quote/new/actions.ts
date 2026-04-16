"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type QuoteItemData = {
  id: string;
  label: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
  section: "main" | "drinks" | "extra";
};

export type SaveQuotePayload = {
  quote_request_id: string;
  quote_id?: string; // si présent → update du brouillon existant
  reference: string;
  valid_until: string | null;
  notes: string;
  guest_count: number;
  items: QuoteItemData[];
};

export async function saveQuote(
  payload: SaveQuotePayload,
  send: boolean
): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("users")
    .select("caterer_id")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catererId = (profile as any)?.caterer_id as string | null;
  if (!catererId) return { error: "Traiteur introuvable" };

  // Guard : empêcher l'envoi si la demande a déjà un devis accepté ou une commande
  if (send) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acceptedQuote } = await (supabase as any)
      .from("quotes")
      .select("id, orders(id)")
      .eq("quote_request_id", payload.quote_request_id)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (acceptedQuote) {
      return { error: "Cette demande a déjà un devis accepté — l'envoi d'un nouveau devis n'est plus possible." };
    }
  }

  const details = payload.items.map((item) => ({
    label: item.label,
    description: item.description || undefined,
    quantity: item.quantity,
    unit_price_ht: item.unit_price_ht,
    total_ht: item.quantity * item.unit_price_ht,
    tva_rate: item.tva_rate,
    section: item.section,
  }));

  const totalHT = details.reduce((s, d) => s + d.total_ht, 0);
  const amountPerPerson =
    payload.guest_count > 0 ? totalHT / payload.guest_count : null;

  const quotePayload = {
    total_amount_ht: totalHT,
    amount_per_person: amountPerPerson,
    details,
    valid_until: payload.valid_until || null,
    reference: payload.reference,
    notes: payload.notes || null,
    status: send ? "sent" : "draft",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: quote, error } = payload.quote_id
    ? await sb
        .from("quotes")
        .update(quotePayload)
        .eq("id", payload.quote_id)
        .eq("caterer_id", catererId)
        .select("id")
        .single()
    : await sb
        .from("quotes")
        .insert({ ...quotePayload, quote_request_id: payload.quote_request_id, caterer_id: catererId })
        .select("id")
        .single();

  if (error) return { error: error.message };

  if (send) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("quote_request_caterers")
      .update({
        status: "transmitted_to_client",
        responded_at: new Date().toISOString(),
      })
      .eq("caterer_id", catererId)
      .eq("quote_request_id", payload.quote_request_id);

    revalidatePath(`/caterer/requests/${payload.quote_request_id}`);
    revalidatePath("/caterer/requests");
  }

  return { id: quote.id };
}
