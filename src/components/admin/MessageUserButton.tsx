import Link from "next/link";
import { MessageSquare } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

/**
 * Lien qui ouvre la messagerie admin sur le thread avec le destinataire.
 *
 * Redirection vers `/admin/messages?to={userId}`. La page admin/messages
 * cherche un thread existant avec ce user ; si aucun, elle en instancie
 * un "pendant" (thread_id généré côté serveur, aucun message inséré) et
 * le passe au MessagingLayout qui affiche une conversation vide prête à
 * recevoir le premier message.
 */
export default function MessageUserButton({
  recipientUserId,
  /** Variante visuelle. "button" = outline compact, "icon" = icône seule ronde. */
  variant = "button",
  label = "Envoyer un message",
}: {
  recipientUserId: string;
  variant?: "button" | "icon";
  label?: string;
}) {
  const href = `/admin/messages?to=${recipientUserId}`;

  if (variant === "icon") {
    return (
      <Link
        href={href}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#1A3A52] hover:bg-[#F0F4F7] transition-colors shrink-0"
        title={label}
        aria-label={label}
      >
        <MessageSquare size={13} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F0F4F8] transition-colors shrink-0"
      style={mFont}
    >
      <MessageSquare size={12} />
      {label}
    </Link>
  );
}
