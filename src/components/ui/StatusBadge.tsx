type BadgeVariant = "new" | "pending" | "sent" | "accepted" | "refused" | "expired" | "confirmed" | "delivered";

const variantStyles: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  new:       { bg: "#E3F4FF", text: "#00AEFF", label: "Nouvelle" },
  pending:   { bg: "#FFF3CD", text: "#B45309", label: "En attente" },
  sent:      { bg: "#E0F2FE", text: "#0284C7", label: "Devis envoyé" },
  accepted:  { bg: "#DCFCE7", text: "#16A34A", label: "Accepté" },
  refused:   { bg: "#FEE2E2", text: "#DC2626", label: "Refusé" },
  expired:   { bg: "#F3F4F6", text: "#6B7280", label: "Expiré" },
  confirmed: { bg: "#E0F2FE", text: "#0284C7", label: "Confirmé" },
  delivered: { bg: "#DCFCE7", text: "#16A34A", label: "Livré" },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  customLabel?: string;
}

export default function StatusBadge({ variant, customLabel }: StatusBadgeProps) {
  const style = variantStyles[variant];
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
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
