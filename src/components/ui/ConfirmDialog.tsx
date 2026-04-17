"use client";

import { AlertTriangle, HelpCircle, X } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type Variant = "default" | "danger";

interface ConfirmDialogProps {
  open:          boolean;
  title:         string;
  message:       string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      Variant;
  onConfirm:     () => void;
  onClose:       () => void;
}

const VARIANT_COLORS: Record<Variant, { iconBg: string; icon: string; confirmBg: string }> = {
  default: { iconBg: "#F0F4F8", icon: "#1A3A52", confirmBg: "#1A3A52" },
  danger:  { iconBg: "#FEF2F2", icon: "#DC2626", confirmBg: "#DC2626" },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel  = "Annuler",
  variant      = "default",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  const colors = VARIANT_COLORS[variant];
  const Icon = variant === "danger" ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 440 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: colors.iconBg }}
            >
              <Icon size={20} style={{ color: colors.icon }} />
            </div>
            <p className="font-display font-bold text-lg text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-black transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-[#313131] leading-relaxed" style={mFont}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-[#F3F4F6] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
            style={mFont}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: colors.confirmBg, ...mFont }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
