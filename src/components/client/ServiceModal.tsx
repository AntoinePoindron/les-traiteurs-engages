"use client";

import { useState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  /** Si true, la modale s'ouvre dès le montage (utile via un lien). */
  defaultOpen?: boolean;
}

function CloseOnSubmitEnd({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending) {
      onClose();
    }
    wasPendingRef.current = pending;
  }, [pending, onClose]);

  return null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
      style={{ backgroundColor: "#1A3A52", ...mFont }}
    >
      <Plus size={13} />
      {pending ? "Création en cours…" : "Créer le service"}
    </button>
  );
}

export default function ServiceModal({ action, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Fermer avec Échap
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Empêcher le scroll du body en arrière-plan
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
        style={{ backgroundColor: "#1A3A52", ...mFont }}
      >
        <Plus size={14} />
        Nouveau service
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-[520px] flex flex-col shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-modal-title"
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 p-6 pb-4">
              <div className="flex flex-col gap-1">
                <p
                  id="service-modal-title"
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  Ajouter un service
                </p>
                <p className="text-xs text-[#6B7280]" style={mFont}>
                  Créez un service interne (direction, RH, DSI…) auquel rattacher vos collaborateurs et vos dépenses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors shrink-0"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulaire */}
            <form action={action} className="flex flex-col gap-4 px-6 pb-6">
              <CloseOnSubmitEnd onClose={() => setOpen(false)} />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Nom du service *</label>
                <input
                  name="name"
                  required
                  placeholder="Ex. : Direction, RH, DSI…"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                  style={mFont}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Description</label>
                <input
                  name="description"
                  placeholder="Courte description (optionnel)"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                  style={mFont}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Budget annuel traiteur (€ HT)</label>
                <input
                  name="annual_budget"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ex. : 5000"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                  style={mFont}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                  style={mFont}
                >
                  Annuler
                </button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
