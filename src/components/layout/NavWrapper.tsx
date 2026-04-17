"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { UserRole } from "@/types/database";

interface NavWrapperProps {
  role: UserRole;
  catererName?: string;
  companyName?: string;
  companyLogoUrl?: string;
  userName?: string;
}

export default function NavWrapper(props: NavWrapperProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Topbar mobile — visible uniquement < md */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-[#f2f2f2] flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1 text-navy"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
        <span
          className="font-display font-bold text-navy text-sm"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          Les Traiteurs Engagés
        </span>
      </div>

      {/* Sidebar desktop — visible uniquement ≥ md */}
      <div className="hidden md:block sticky top-0 h-screen shrink-0">
        <Sidebar {...props} />
      </div>

      {/* Drawer mobile — monté uniquement quand open */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Panel */}
          <div className="h-full bg-white shadow-xl overflow-y-auto" style={{ width: "241px" }}>
            <Sidebar {...props} />
          </div>
          {/* Zone de fermeture */}
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
