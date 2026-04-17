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

  // Récupérer l'état du qrc pour ce traiteur sur cette demande.
  // Contrôle à la fois l'acceptation d'un devis déjà accepté et le
  // verrouillage en mode comparer-3 (qrc.status = 'closed' quand
  // 3 devis ont déjà été transmis au client).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: qrcRow } = await (supabase as any)
    .from("quote_request_caterers")
    .select("status")
    .eq("quote_request_id", payload.quote_request_id)
    .eq("caterer_id", catererId)
    .maybeSingle();
  const qrcStatus: string | null = qrcRow?.status ?? null;

  if (send) {
    if (qrcStatus === "closed") {
      return {
        error:
          "La limite de 3 devis a déjà été atteinte pour cette demande — vous ne pouvez plus y répondre.",
      };
    }
    if (qrcStatus === "rejected") {
      return { error: "Vous avez refusé cette demande, l'envoi d'un devis n'est plus possible." };
    }

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
    // On ne passe le qrc en "responded" que s'il est encore en
    // "selected". Le trigger SQL `apply_three_responders_rule` promeut
    // ensuite les 3 premiers à "transmitted_to_client" (visible côté
    // client) et le trigger `qrc_lock_out_trigger` verrouille les
    // autres `selected` dès qu'un 3ème passe en `transmitted_to_client`.
    // Si le qrc est déjà en `responded` ou `transmitted_to_client`
    // (ré-envoi d'un devis corrigé), on ne touche pas au statut.
    if (qrcStatus === "selected") {
      // IMPORTANT : on ne set PAS `responded_at` ici. La trigger SQL
      // `apply_three_responders_rule` (migration 001) ne calcule le
      // rang et ne promeut en `transmitted_to_client` que si
      // `NEW.responded_at is null`. Si on le pré-remplit, la trigger
      // skip et les devis ne sont jamais remontés au client.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("quote_request_caterers")
        .update({ status: "responded" })
        .eq("caterer_id", catererId)
        .eq("quote_request_id", payload.quote_request_id);
    }

    revalidatePath(`/caterer/requests/${payload.quote_request_id}`);
    revalidatePath("/caterer/requests");
  }

  return { id: quote.id };
}
