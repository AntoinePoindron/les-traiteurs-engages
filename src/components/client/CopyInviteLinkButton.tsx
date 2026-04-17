"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface Props {
  email: string;
}

/**
 * Bouton qui copie dans le presse-papier le lien d'invitation
 * `/signup?email=<email>` (origin du navigateur courant). L'admin
 * peut ensuite le coller dans n'importe quel canal pour l'envoyer
 * à son collaborateur.
 */
export default function CopyInviteLinkButton({ email }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const url = `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback : prompt avec le lien si clipboard refusé
      window.prompt("Copiez ce lien d'invitation :", url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors shrink-0"
      style={{
        ...mFont,
        borderColor: copied ? "#16A34A" : "#1A3A52",
        color: copied ? "#16A34A" : "#1A3A52",
        backgroundColor: copied ? "#DCFCE7" : "transparent",
      }}
      title="Copier le lien d'invitation à envoyer au collaborateur"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copié !" : "Copier l'invitation"}
    </button>
  );
}
