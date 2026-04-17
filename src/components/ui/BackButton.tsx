"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  label?:   string;
  // Par défaut : router.back(). Fournir onClick pour override
  // (ex. redirect vers une URL précise, ou ouvrir une modale
  // de confirmation avant de quitter un formulaire).
  onClick?: () => void;
}

export default function BackButton({ label = "Retour", onClick }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={onClick ?? (() => router.back())}
      className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3A52] w-fit hover:opacity-70 transition-opacity"
      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
