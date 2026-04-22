"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, LayoutGrid } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default function NewRequestDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#1A3A52", ...mFont }}
      >
        <Plus size={16} />
        Nouvelle demande
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#F3F4F6] overflow-hidden z-50"
          style={{ minWidth: 260 }}
        >
          <button
            onClick={() => go("/client/search")}
            className="w-full flex items-start gap-3 px-5 py-4 hover:bg-[#F5F1E8] transition-colors text-left border-b border-[#F3F4F6]"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "#F0F4F7" }}
            >
              <Search size={15} style={{ color: "#1A3A52" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-black" style={mFont}>
                Trouver un traiteur
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>
                Parcourir le catalogue et contacter directement
              </p>
            </div>
          </button>

          <button
            onClick={() => go("/client/requests/new?mode=compare")}
            className="w-full flex items-start gap-3 px-5 py-4 hover:bg-[#F5F1E8] transition-colors text-left"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "#F0F4F7" }}
            >
              <LayoutGrid size={15} style={{ color: "#1A3A52" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-black" style={mFont}>
                Recevoir 3 devis
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5" style={mFont}>
                Comparer les offres des traiteurs les plus adaptés
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
