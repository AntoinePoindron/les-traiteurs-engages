"use client";

import { useState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Pencil, X } from "lucide-react";
import { checkEmailHasAccount } from "@/app/(dashboard)/client/team/actions";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type Mode = "add" | "edit";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  position: string | null;
  service_id: string | null;
}

interface Props {
  mode: Mode;
  services: { id: string; name: string }[];
  action: (formData: FormData) => void | Promise<void>;
  employee?: Employee; // requis si mode === "edit"
  /** Si true, la modale s'ouvre dès le montage (utile après une action serveur) */
  defaultOpen?: boolean;
}

// Helper qui ferme la modal quand la soumission du form vient de se terminer
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

function SubmitButton({ mode, blocked }: { mode: Mode; blocked?: boolean }) {
  const { pending } = useFormStatus();
  const Icon = mode === "add" ? UserPlus : Pencil;
  const idleLabel = mode === "add" ? "Ajouter" : "Enregistrer";
  const pendingLabel = mode === "add" ? "Ajout en cours…" : "Enregistrement…";
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
      style={{ backgroundColor: "#1A3A52", ...mFont }}
    >
      <Icon size={13} />
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export default function EmployeeModal({ mode, services, action, employee, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Vérification de l'unicité de l'email (mode "add" uniquement).
  // En mode "edit", on ne re-vérifie pas car l'email peut déjà être lié
  // au compte du collaborateur.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  async function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (mode !== "add") return;
    const value = e.target.value.trim().toLowerCase();
    if (!value) { setEmailError(null); return; }
    setEmailChecking(true);
    try {
      const exists = await checkEmailHasAccount(value);
      setEmailError(
        exists
          ? "Cet email est déjà associé à un compte existant — il ne peut pas être invité."
          : null
      );
    } catch {
      // En cas d'erreur réseau, on n'affiche rien : le serveur fera quand même
      // sa propre vérification au submit.
      setEmailError(null);
    } finally {
      setEmailChecking(false);
    }
  }

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

  const isEdit = mode === "edit";
  const title = isEdit ? "Modifier le collaborateur" : "Ajouter un collaborateur";
  const subtitle = isEdit
    ? "Mettez à jour les informations de votre collaborateur."
    : "Renseignez les informations de votre collaborateur.";

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#1A3A52] hover:bg-[#F0F4F7] transition-colors shrink-0"
          title="Modifier"
          aria-label="Modifier le collaborateur"
        >
          <Pencil size={12} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "#1A3A52", ...mFont }}
        >
          <UserPlus size={14} />
          Ajouter un collaborateur
        </button>
      )}

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
            aria-labelledby={`employee-modal-title-${employee?.id ?? "add"}`}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 p-6 pb-4">
              <div className="flex flex-col gap-1">
                <p
                  id={`employee-modal-title-${employee?.id ?? "add"}`}
                  className="font-display font-bold text-xl text-black"
                  style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                >
                  {title}
                </p>
                <p className="text-xs text-[#6B7280]" style={mFont}>
                  {subtitle}
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

              {isEdit && employee && (
                <input type="hidden" name="employee_id" value={employee.id} />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-black" style={mFont}>Prénom *</label>
                  <input
                    name="first_name" required
                    defaultValue={employee?.first_name ?? ""}
                    placeholder="Prénom"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-black" style={mFont}>Nom *</label>
                  <input
                    name="last_name" required
                    defaultValue={employee?.last_name ?? ""}
                    placeholder="Nom de famille"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Email</label>
                <input
                  name="email" type="email"
                  defaultValue={employee?.email ?? ""}
                  placeholder="email@entreprise.fr"
                  onBlur={handleEmailBlur}
                  onChange={() => emailError && setEmailError(null)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm text-black focus:outline-none transition-colors"
                  style={{
                    ...mFont,
                    borderColor: emailError ? "#DC2626" : "#E5E7EB",
                  }}
                />
                {emailChecking && (
                  <p className="text-[11px] text-[#9CA3AF]" style={mFont}>Vérification…</p>
                )}
                {emailError && (
                  <p className="text-[11px] text-[#DC2626]" style={mFont}>{emailError}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Poste</label>
                <input
                  name="position"
                  defaultValue={employee?.position ?? ""}
                  placeholder="Ex. : Responsable, Chargé de mission…"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black focus:outline-none focus:border-[#1A3A52] transition-colors"
                  style={mFont}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-black" style={mFont}>Service</label>
                <select
                  name="service_id"
                  defaultValue={employee?.service_id ?? ""}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-black bg-white focus:outline-none focus:border-[#1A3A52] transition-colors"
                  style={mFont}
                >
                  <option value="">— Aucun service —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
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
                <SubmitButton mode={mode} blocked={Boolean(emailError) || emailChecking} />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
