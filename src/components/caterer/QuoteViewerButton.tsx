"use client";

import { useState } from "react";
import { FileText, Maximize2 } from "lucide-react";
import QuotePreviewModal from "@/components/caterer/QuotePreviewModal";
import type { CatererInfo, PreviewData } from "@/components/caterer/QuotePreviewModal";

interface QuoteViewerButtonProps {
  caterer: CatererInfo;
  data: PreviewData;
}

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function QuoteViewerButton({ caterer, data }: QuoteViewerButtonProps) {
  const [open, setOpen] = useState(false);

  const subtitle = data.reference
    ? `Réf. ${data.reference}`
    : "Aperçu PDF";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-3 p-3 rounded-lg border bg-white text-left transition-all hover:border-[#1A3A52] hover:shadow-sm cursor-pointer"
        style={{ borderColor: "#E5E7EB" }}
        aria-label="Ouvrir l'aperçu du devis"
      >
        {/* Vignette document */}
        <div
          className="relative w-10 h-12 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: "#F5F1E8" }}
        >
          <FileText size={18} style={{ color: "#1A3A52" }} />
          {/* Coin replié — style "page" */}
          <div
            className="absolute top-0 right-0 w-2.5 h-2.5"
            style={{
              backgroundColor: "#FFFFFF",
              clipPath: "polygon(0 0, 100% 100%, 100% 0)",
            }}
          />
        </div>

        {/* Texte */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-xs font-bold text-black truncate" style={mFont}>
            Voir le devis
          </span>
          <span className="text-[10px] text-[#6B7280] truncate" style={mFont}>
            {subtitle} · ouvre l&apos;aperçu
          </span>
        </div>

        {/* Indicateur d'ouverture */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#F5F1E8]"
          style={{ backgroundColor: "#F9FAFB" }}
        >
          <Maximize2 size={13} style={{ color: "#1A3A52" }} />
        </div>
      </button>

      {open && (
        <QuotePreviewModal
          caterer={caterer}
          data={data}
          onClose={() => setOpen(false)}
          viewOnly
        />
      )}
    </>
  );
}
