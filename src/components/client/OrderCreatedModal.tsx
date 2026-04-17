"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { CheckCircle, X, ShoppingBag } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface OrderCreatedModalProps {
  orderId: string;
}

export default function OrderCreatedModal({ orderId }: OrderCreatedModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    // Retire le param `?accepted=…` de l'URL pour ne pas rouvrir
    // la modale au reload.
    router.replace(pathname);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 460 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#DCFCE7" }}
            >
              <CheckCircle size={20} style={{ color: "#16A34A" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-black" style={mFont}>
                Devis accepté
              </p>
              <p className="text-xs text-[#6B7280]" style={mFont}>
                Votre commande est confirmée.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-[#9CA3AF] hover:text-black transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <p className="text-sm text-[#313131] leading-relaxed" style={mFont}>
            Le traiteur a été notifié et recevra toutes les informations
            nécessaires pour préparer votre prestation. Vous pouvez suivre
            l&apos;avancement de la commande depuis votre espace.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-[#F3F4F6] shrink-0">
          <button
            type="button"
            onClick={close}
            className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
            style={mFont}
          >
            Fermer
          </button>
          <Link
            href={`/client/orders/${orderId}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#1A3A52", ...mFont }}
          >
            <ShoppingBag size={13} />
            Voir la commande
          </Link>
        </div>
      </div>
    </div>
  );
}
