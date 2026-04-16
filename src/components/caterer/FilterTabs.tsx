"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

export type RequestFilter =
  | "all"
  | "new"
  | "pending"
  | "sent"
  | "accepted"
  | "refused"
  | "archived";

const TABS: { value: RequestFilter; label: string }[] = [
  { value: "all",      label: "Toutes" },
  { value: "new",      label: "Nouvelle" },
  { value: "pending",  label: "Devis en attente" },
  { value: "sent",     label: "Devis envoyé" },
  { value: "accepted", label: "Devis accepté" },
  { value: "refused",  label: "Devis refusé" },
  { value: "archived", label: "Archivées" },
];

interface FilterTabsProps {
  activeFilter: RequestFilter;
  searchQuery: string;
}

export default function FilterTabs({ activeFilter, searchQuery }: FilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
      {/* Onglets filtres — scroll horizontal sur mobile, wrap sur desktop */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => updateParams("filter", tab.value === "all" ? "" : tab.value)}
              className="px-3 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              style={{
                fontFamily: "Marianne, system-ui, sans-serif",
                backgroundColor: isActive ? "#1A3A52" : "#F5F1E8",
                color: isActive ? "#FFFFFF" : "#1A3A52",
                border: isActive ? "1px solid #1A3A52" : "none",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Recherche — pleine largeur sur mobile, fixe sur desktop */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black w-full md:w-[261px] md:self-end"
      >
        <input
          type="text"
          placeholder="Rechercher..."
          defaultValue={searchQuery}
          onChange={(e) => updateParams("q", e.target.value)}
          className="flex-1 text-xs outline-none bg-transparent"
          style={{
            fontFamily: "Marianne, system-ui, sans-serif",
            color: "#1A1A1A",
          }}
        />
        <Search size={16} className="text-[#bfbfbf] shrink-0" />
      </div>
    </div>
  );
}
