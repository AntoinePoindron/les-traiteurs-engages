import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Téléchargement direct du PDF de la facture Stripe pour une commande.
 *
 * Flow :
 *  1. Auth via session Supabase (cookie). La RLS sur `orders` garantit
 *     que seul un user autorisé (créateur, admin company, super_admin)
 *     peut voir la ligne.
 *  2. Récupère `stripe_invoice_id` depuis la commande.
 *  3. Stripe `invoices.retrieve()` → URL PDF signée (`invoice_pdf`).
 *  4. On **stream le PDF** bytes-à-bytes côté serveur avec un header
 *     `Content-Disposition: attachment` → le navigateur télécharge le
 *     fichier sans quitter la page courante (pas de navigation, pas
 *     de nouvel onglet).
 *
 * Pourquoi streamer et pas redirect :
 *  - Un redirect vers Stripe ouvre le PDF inline dans le navigateur
 *    (Chrome/Firefox le rendent dans un nouvel onglet au lieu de le
 *    télécharger). L'UX est cassée.
 *  - En streamant derrière notre endpoint, on peut forcer le download
 *    via `Content-Disposition: attachment; filename="..."`.
 *  - Bonus : on contrôle le nom du fichier (FAC-XXX.pdf) pour l'user.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // La RLS filtre automatiquement sur ce que l'user peut voir.
  // On récupère aussi la référence du devis pour nommer le fichier.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRow } = await (supabase as any)
    .from("orders")
    .select(`
      id, stripe_invoice_id,
      quotes!inner ( reference )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!orderRow) {
    return NextResponse.json(
      { error: "Commande introuvable ou accès refusé" },
      { status: 404 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = orderRow as any;
  const invoiceId: string | null = row.stripe_invoice_id ?? null;
  const quoteRef: string | null = row.quotes?.reference ?? null;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "Facture non émise pour cette commande" },
      { status: 404 },
    );
  }

  try {
    const stripe = getStripeClient();
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const pdfUrl = invoice.invoice_pdf;

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "PDF de la facture indisponible" },
        { status: 404 },
      );
    }

    // Télécharge le PDF depuis Stripe (URL signée — accès autorisé
    // depuis le serveur). On récupère les bytes et on les relaie
    // vers le navigateur du client.
    const pdfResp = await fetch(pdfUrl);
    if (!pdfResp.ok || !pdfResp.body) {
      return NextResponse.json(
        { error: "Échec de téléchargement du PDF depuis Stripe" },
        { status: 502 },
      );
    }

    // Construit un nom de fichier lisible basé sur la réf devis
    // (ex. FAC-ACME-2026-015.pdf), sinon fallback.
    const invoiceRef = (invoice.number ?? quoteRef ?? `invoice-${invoiceId}`).replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const filename = `${invoiceRef}.pdf`;

    return new Response(pdfResp.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // `attachment` force le téléchargement plutôt que le rendu inline.
        // Sans ça le navigateur ouvre le PDF dans un nouvel onglet.
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Cache court : l'URL est la même par commande mais le PDF
        // peut changer (ex. correction), on évite donc un cache agressif.
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoice-pdf] Stripe retrieve failed:", msg);
    return NextResponse.json(
      { error: "Impossible de récupérer la facture depuis Stripe" },
      { status: 500 },
    );
  }
}
