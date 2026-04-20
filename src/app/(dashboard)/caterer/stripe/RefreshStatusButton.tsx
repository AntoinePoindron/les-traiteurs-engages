"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { refreshCatererStripeStatus } from "./actions";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await refreshCatererStripeStatus();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  const isWorking = loading || pending;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isWorking}
        className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F0F4F8] transition-colors disabled:opacity-60"
        style={mFont}
      >
        {isWorking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {isWorking ? "Vérification…" : "Vérifier le statut"}
      </button>
      {error && (
        <p className="text-xs text-[#DC2626]" style={mFont}>{error}</p>
      )}
    </div>
  );
}
