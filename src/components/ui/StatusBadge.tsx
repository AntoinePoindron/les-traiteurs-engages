type BadgeVariant =
  | "new" | "pending" | "sent" | "accepted" | "refused" | "expired"
  | "confirmed" | "delivered" | "invoiced" | "paid" | "disputed"
  // Client-side request statuses
  | "submitted" | "awaiting_quotes" | "quotes_received" | "quote_accepted"
  | "completed" | "cancelled" | "quotes_refused";

const variantStyles: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  new:              { bg: "#E3F4FF", text: "#00AEFF",  label: "Nouvelle" },
  pending:          { bg: "#FFF3CD", text: "#B45309",  label: "En attente" },
  sent:             { bg: "#E0F2FE", text: "#0284C7",  label: "Devis envoyé" },
  accepted:         { bg: "#D1FAE5", text: "#065F46",  label: "Commande créée" },
  refused:          { bg: "#FEE2E2", text: "#DC2626",  label: "Refusé" },
  expired:          { bg: "#F3F4F6", text: "#6B7280",  label: "Expiré" },
  confirmed:        { bg: "#EDE9FE", text: "#7C3AED",  label: "Confirmée" },
  delivered:        { bg: "#DCFCE7", text: "#16A34A",  label: "Livrée" },
  invoiced:         { bg: "#E0F2FE", text: "#0284C7",  label: "Facturée" },
  paid:             { bg: "#D1FAE5", text: "#065F46",  label: "Payée" },
  disputed:         { bg: "#FEE2E2", text: "#DC2626",  label: "Litige" },
  // Client request statuses
  submitted:        { bg: "#F0F4F8", text: "#1A3A52",  label: "Soumise" },
  awaiting_quotes:  { bg: "#FFF3CD", text: "#B45309",  label: "En attente de devis" },
  quotes_received:  { bg: "#E3F4FF", text: "#0284C7",  label: "Devis reçu(s)" },
  quote_accepted:   { bg: "#D1FAE5", text: "#065F46",  label: "Commande créée" },
  completed:        { bg: "#D1FAE5", text: "#065F46",  label: "Commande créée" },
  cancelled:        { bg: "#F3F4F6", text: "#6B7280",  label: "Annulée" },
  quotes_refused:   { bg: "#FEE2E2", text: "#DC2626",  label: "Devis refusé" },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  customLabel?: string;
}

export default function StatusBadge({ variant, customLabel }: StatusBadgeProps) {
  const style = variantStyles[variant];
  return (
    <span
      className="inline-flex w-fit items-center justify-center px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        fontFamily: "Marianne, system-ui, sans-serif",
      }}
    >
      {customLabel ?? style.label}
    </span>
  );
}
