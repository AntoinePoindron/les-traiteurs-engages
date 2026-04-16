"use client";

import { useState, useRef } from "react";
import { XCircle } from "lucide-react";

interface RefuseQuoteButtonProps {
  action: (formData: FormData) => Promise<void>;
  quoteId: string;
  requestId: string;
}

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function RefuseQuoteButton({ action, quoteId, requestId }: RefuseQuoteButtonProps) {
  const [open, setOpen]     = useState(false);
  const [reason, setReason] = useState("");
  const formRef             = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-colors border"
        style={{ ...mFont, borderColor: "#DC2626", color: "#DC2626", backgroundColor: "transparent" }}
      >
        <XCircle size={13} />
        Refuser ce devis
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg border border-[#DC2626]/30" style={{ backgroundColor: "#FFF5F5" }}>
      <p className="text-xs font-bold text-black" style={mFont}>
        Motif du refus
      </p>
      <p className="text-[11px] text-[#6B7280]" style={mFont}>
        Votre retour aide le traiteur à mieux comprendre votre besoin.
      </p>

      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="quote_id"   value={quoteId} />
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="reason"     value={reason} />

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. : budget trop élevé, nous avons retenu un autre prestataire…"
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs text-black resize-none focus:outline-none focus:border-[#DC2626] transition-colors bg-white"
          style={mFont}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setReason(""); }}
            className="flex-1 px-3 py-2 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
            style={mFont}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!reason.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ ...mFont, backgroundColor: "#DC2626" }}
          >
            <XCircle size={12} />
            Confirmer
          </button>
        </div>
      </form>
    </div>
  );
}
