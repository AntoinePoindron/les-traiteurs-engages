"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
}

export default function BackButton({ label = "Retour" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3A52] w-fit hover:opacity-70 transition-opacity"
      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  );
}
