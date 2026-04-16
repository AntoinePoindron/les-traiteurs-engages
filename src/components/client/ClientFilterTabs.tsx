"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

export type ClientRequestFilter =
  | "all"
  | "pending"
  | "quotes"
  | "accepted"
  | "closed";

const TABS: { value: ClientRequestFilter; label: string }[] = [
  { value: "all",      label: "Toutes" },
  { value: "pending",  label: "Soumises" },
  { value: "quotes",   label: "Devis reçu(s)" },
  { value: "accepted", label: "Devis accepté" },
  { value: "closed",   label: "Clôturées" },
];

interface Props {
  activeFilter: ClientRequestFilter;
  searchQuery: string;
}

export default function ClientFilterTabs({ activeFilter, searchQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="bg-white rounded-lg p-6 flex items-center gap-4">
      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => updateParams("filter", tab.value === "all" ? "" : tab.value)}
              className="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer"
              style={{
                fontFamily: "Marianne, system-ui, sans-serif",
                backgroundColor: isActive ? "#1A3A52" : "#F5F1E8",
                color: isActive ? "#FFFFFF" : "#1A3A52",
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = "#E8E3D8"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = "#F5F1E8"; } }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] shrink-0 w-[220px] focus-within:border-[#1A3A52] transition-colors">
        <input
          type="text"
          placeholder="Rechercher..."
          defaultValue={searchQuery}
          onChange={(e) => updateParams("q", e.target.value)}
          className="flex-1 text-xs outline-none bg-transparent"
          style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#1A1A1A" }}
        />
        <Search size={16} className="text-[#bfbfbf] shrink-0" />
      </div>
    </div>
  );
}
