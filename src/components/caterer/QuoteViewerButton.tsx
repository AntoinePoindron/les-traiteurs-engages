"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import QuotePreviewModal from "@/components/caterer/QuotePreviewModal";
import type { CatererInfo, PreviewData } from "@/components/caterer/QuotePreviewModal";

interface QuoteViewerButtonProps {
  caterer: CatererInfo;
  data: PreviewData;
}

export default function QuoteViewerButton({ caterer, data }: QuoteViewerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "#1A3A52",
          fontFamily: "Marianne, system-ui, sans-serif",
        }}
      >
        <Eye size={14} />
        Voir le devis
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
