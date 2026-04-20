"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { createOrderCheckoutSession } from "./actions";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function PayOrderButton({
  orderId,
  amountLabel,
}: {
  orderId: string;
  /** ex. "1 250 €" pour afficher le montant sur le bouton. Optionnel. */
  amountLabel?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await createOrderCheckoutSession(orderId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push(res.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#1A3A52", ...mFont }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
        {loading
          ? "Préparation du paiement…"
          : amountLabel
            ? `Payer ${amountLabel}`
            : "Payer la commande"}
      </button>
      {error && (
        <p className="text-xs text-[#DC2626]" style={mFont}>{error}</p>
      )}
    </div>
  );
}
