"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

/**
 * Bouton "Télécharger la facture" avec spinner pendant le fetch.
 *
 * Plutôt que d'utiliser un simple <a href> (qui ne permet pas de
 * montrer un état de chargement), on fait :
 *   1. fetch() vers l'API route qui stream le PDF
 *   2. on récupère les bytes sous forme de Blob
 *   3. on crée une URL blob: et on déclenche un download programmatique
 *      via un <a download> invisible
 *   4. on libère l'URL une fois le clic simulé
 *
 * Pendant tout ce temps le bouton est en mode "Loader2 qui tourne"
 * → feedback visuel clair pour l'utilisateur.
 */
interface Props {
  orderId: string;
  filename?: string;
  label?: string;
}

export default function DownloadInvoiceButton({
  orderId,
  filename,
  label = "Télécharger la facture",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`/api/orders/${orderId}/invoice-pdf`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error ?? `Échec (${resp.status})`);
      }

      // Récupère le filename depuis Content-Disposition côté serveur
      // si dispo, sinon fallback sur la prop `filename` ou un nom par défaut.
      const contentDisposition = resp.headers.get("content-disposition") ?? "";
      const cdMatch = /filename="([^"]+)"/.exec(contentDisposition);
      const resolvedFilename =
        cdMatch?.[1] ?? filename ?? `facture-${orderId}.pdf`;

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      // Déclenche le download via un <a download> temporaire
      const a = document.createElement("a");
      a.href = url;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Libère l'URL pour permettre au GC de réclamer le Blob
      // (pas de fuite mémoire si l'user télécharge plusieurs factures).
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[DownloadInvoiceButton] failed:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
        style={mFont}
      >
        {loading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Téléchargement…
          </>
        ) : (
          <>
            <Download size={12} />
            {label}
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-[#DC2626]" style={mFont}>
          {error}
        </p>
      )}
    </div>
  );
}
