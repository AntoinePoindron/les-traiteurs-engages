"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { createCatererOnboardingLink } from "./actions";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function StartOnboardingButton({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await createCatererOnboardingLink();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Redirect browser to the Stripe-hosted onboarding page
    router.push(result.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="self-start inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#1A3A52", ...mFont }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
        {loading ? "Préparation…" : label}
      </button>
      {error && (
        <p className="text-xs text-[#DC2626]" style={mFont}>{error}</p>
      )}
    </div>
  );
}
