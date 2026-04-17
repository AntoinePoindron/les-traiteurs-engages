"use client";

import { useState } from "react";
import { CheckCircle, X, Users, Calendar, MapPin, Utensils, Euro } from "lucide-react";
import { approveCompareRequestAction, rejectRequestAction } from "../actions";
import ContactClientButton from "@/components/admin/ContactClientButton";
import type { MatchedCaterer } from "@/lib/caterer-matching";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

interface Props {
  requestId:          string;
  serviceLabel:       string;
  eventDate:          string;
  eventAddress:       string;
  guestCount:         number;
  companyName:        string | null;
  companyCity:        string | null;
  description:        string | null;
  messageToClient:    string | null;
  budgetGlobal:       number | null;
  budgetPerPerson:    number | null;
  dietaryLabels:      string[];
  matching:           MatchedCaterer[];
  isAlreadySent:      boolean;
  isCancelled:        boolean;
  hasEventCoords:     boolean;
  adminUserId:        string;
  clientUserId:       string | null;
  clientName:         string;
  existingThreadId:   string | null;
}

export default function CompareRequestApproval({
  requestId,
  serviceLabel,
  eventDate,
  eventAddress,
  guestCount,
  companyName,
  companyCity,
  description,
  messageToClient,
  budgetGlobal,
  budgetPerPerson,
  dietaryLabels,
  matching,
  isAlreadySent,
  isCancelled,
  hasEventCoords,
  adminUserId,
  clientUserId,
  clientName,
  existingThreadId,
}: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const disabled = isAlreadySent || isCancelled;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
      {/* ── Colonne gauche : détail demande ── */}
      <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]" style={mFont}>
            Demande du client
          </p>
          <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
            {companyName ?? "—"}
          </p>
          {companyCity && (
            <p className="text-xs text-[#6B7280]" style={mFont}>{companyCity}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t border-[#F3F4F6]">
          <InfoRow icon={Utensils} label="Prestation" value={serviceLabel} />
          <InfoRow icon={Calendar} label="Date" value={eventDate} />
          <InfoRow icon={MapPin}   label="Lieu" value={eventAddress} />
          <InfoRow icon={Users}    label="Convives" value={`${guestCount} personnes`} />
          {budgetGlobal != null && (
            <InfoRow icon={Euro} label="Budget total" value={`${budgetGlobal.toLocaleString("fr-FR")} €`} />
          )}
          {budgetPerPerson != null && (
            <InfoRow icon={Euro} label="Budget / pers." value={`${budgetPerPerson.toLocaleString("fr-FR")} €`} />
          )}
          {dietaryLabels.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] text-[#9CA3AF]" style={mFont}>Régimes</p>
              <div className="flex flex-wrap gap-1.5">
                {dietaryLabels.map((d) => (
                  <span
                    key={d}
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: "#F5F1E8", color: "#1A3A52", ...mFont }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {description && (
          <div className="flex flex-col gap-1.5 pt-4 border-t border-[#F3F4F6]">
            <p className="text-[11px] text-[#9CA3AF]" style={mFont}>Description</p>
            <p className="text-sm text-[#313131] leading-relaxed" style={mFont}>{description}</p>
          </div>
        )}

        {messageToClient && (
          <div className="flex flex-col gap-1.5 pt-4 border-t border-[#F3F4F6]">
            <p className="text-[11px] text-[#9CA3AF]" style={mFont}>Message du client</p>
            <p className="text-sm text-[#313131] leading-relaxed italic" style={mFont}>&ldquo;{messageToClient}&rdquo;</p>
          </div>
        )}

        {clientUserId && (
          <div className="pt-4 border-t border-[#F3F4F6]">
            <ContactClientButton
              adminUserId={adminUserId}
              clientUserId={clientUserId}
              clientName={clientName}
              requestId={requestId}
              existingThreadId={existingThreadId}
            />
          </div>
        )}
      </div>

      {/* ── Colonne droite : panel d'approbation ── */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-lg p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]" style={mFont}>
              Diffusion
            </p>
            <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
              {matching.length} traiteur{matching.length > 1 ? "s" : ""} matchant{matching.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-[#6B7280]" style={mFont}>
              {hasEventCoords
                ? "Filtrés par prestation, capacité, régimes et rayon de livraison."
                : "Adresse non géocodée — matching sans filtre géographique."}
            </p>
          </div>

          {matching.length > 0 && (
            <div className="flex flex-col gap-2 pt-3 border-t border-[#F3F4F6] max-h-64 overflow-y-auto">
              {matching.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm font-bold text-black truncate" style={mFont}>{c.name}</span>
                  {c.distance_km != null && (
                    <span className="text-[11px] text-[#6B7280] shrink-0" style={mFont}>
                      {Math.round(c.distance_km)} km
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {matching.length === 0 && !disabled && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{ backgroundColor: "#FEF2F2", color: "#991B1B", ...mFont }}
            >
              Aucun traiteur ne correspond aux critères. Contactez le client pour affiner, ou refusez la demande.
            </div>
          )}

          {!disabled && matching.length > 0 && (
            <form action={approveCompareRequestAction} className="flex flex-col gap-2">
              <input type="hidden" name="request_id" value={requestId} />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#1A3A52", ...mFont }}
              >
                <CheckCircle size={13} />
                Approuver et diffuser
              </button>
            </form>
          )}

          {!disabled && (
            <button
              type="button"
              onClick={() => setRejectOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#DC2626] hover:bg-[#FFF5F5] transition-colors"
              style={mFont}
            >
              <X size={13} />
              Refuser la demande
            </button>
          )}

          {rejectOpen && (
            <form action={rejectRequestAction} className="flex flex-col gap-2 pt-3 border-t border-[#F3F4F6]">
              <input type="hidden" name="request_id" value={requestId} />
              <textarea
                name="notes"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Motif du refus (visible par le client)"
                rows={3}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-black outline-none focus:border-[#1A3A52] transition-colors resize-none"
                style={mFont}
              />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#DC2626", ...mFont }}
              >
                Confirmer le refus
              </button>
            </form>
          )}

          {isAlreadySent && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{ backgroundColor: "#F0F9FF", color: "#1E40AF", ...mFont }}
            >
              Demande déjà diffusée aux traiteurs matchants.
            </div>
          )}
          {isCancelled && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{ backgroundColor: "#FEF2F2", color: "#991B1B", ...mFont }}
            >
              Demande annulée.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[#9CA3AF] mt-0.5 shrink-0" />
      <div className="flex flex-col min-w-0">
        <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{label}</p>
        <p className="text-sm font-bold text-black" style={mFont}>{value}</p>
      </div>
    </div>
  );
}
