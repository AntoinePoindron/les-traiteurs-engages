"use client";

import { useState } from "react";
import { X, CheckCircle, MapPin, Users, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { approveRequestAction, rejectRequestAction } from "../actions";
import ContactClientButton from "@/components/admin/ContactClientButton";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

type MatchInfo = {
  service: boolean;
  capacity: boolean;
  vegetarian: boolean;
  halal: boolean;
  glutenFree: boolean;
  score: number;
};

export type ScoredCaterer = {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  esat_status: boolean;
  description: string | null;
  delivery_radius_km: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  specialties: string[];
  address: string | null;
  zip_code: string | null;
  match: MatchInfo;
  scorePercent: number;
};

export type RequestData = {
  id: string;
  event_date: string;
  event_start_time: string | null;
  event_end_time: string | null;
  event_address: string;
  guest_count: number;
  service_type: string | null;
  meal_type: string | null;
  budget_global: number | null;
  budget_per_person: number | null;
  budget_flexibility: string | null;
  dietary_vegetarian: boolean;
  dietary_halal: boolean;
  dietary_gluten_free: boolean;
  dietary_bio: boolean;
  description: string | null;
  message_to_caterer: string | null;
  super_admin_notes: string | null;
  companies: { name: string; city: string | null } | null;
};

interface Props {
  req: RequestData;
  serviceLabel: string;
  eventDate: string;
  isAlreadySent: boolean;
  isCancelled: boolean;
  caterers: ScoredCaterer[];
  hasActiveDietary: boolean;
  requestId: string;
  adminUserId: string;
  clientUserId: string | null;
  clientName: string;
  existingThreadId: string | null;
}

const MAX = 3;

export default function CatererSelector({
  req, serviceLabel, eventDate,
  isAlreadySent, isCancelled,
  caterers, hasActiveDietary,
  requestId, adminUserId, clientUserId, clientName, existingThreadId,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [modalCaterer, setModalCaterer] = useState<ScoredCaterer | null>(null);

  const displayedCaterers = showAll ? caterers : caterers.slice(0, 8);
  const selectedCaterers = selected
    .map(id => caterers.find(c => c.id === id))
    .filter(Boolean) as ScoredCaterer[];

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < MAX ? [...prev, id] : prev
    );
  }

  function remove(id: string) {
    setSelected(prev => prev.filter(x => x !== id));
  }

  // Dietary tags
  const dietaryTags = [
    req.dietary_vegetarian && "Végétarien",
    req.dietary_halal      && "Halal",
    req.dietary_gluten_free && "Sans gluten",
    req.dietary_bio        && "Bio",
  ].filter(Boolean) as string[];

  return (
    <>
      {/* ── Rangée 1 : résumé pleine largeur ──────────────────── */}
      <div className="bg-white rounded-lg overflow-hidden">
        <div className="flex flex-col md:flex-row">

          {/* Infos événement condensées */}
          <div className="flex-1 min-w-0 p-5 flex flex-col gap-3">
            <p
              className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide"
              style={mFont}
            >
              Événement
            </p>

            {/* Grille 2 col compacte */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <InlineRow label="Type"     value={serviceLabel} />
              <InlineRow label="Date"     value={eventDate} />
              {(req.event_start_time || req.event_end_time) && (
                <InlineRow
                  label="Horaires"
                  value={[req.event_start_time, req.event_end_time].filter(Boolean).join(" – ")}
                />
              )}
              <InlineRow label="Convives" value={`${req.guest_count} pers.`} />
              <InlineRow label="Lieu"     value={req.event_address} wide />
              {req.budget_global && (
                <InlineRow
                  label="Budget"
                  value={`${Number(req.budget_global).toLocaleString("fr-FR")} €`}
                />
              )}
              {req.budget_per_person && (
                <InlineRow
                  label="Par pers."
                  value={`${Number(req.budget_per_person).toLocaleString("fr-FR")} €`}
                />
              )}
            </div>

            {/* Tags régimes */}
            {dietaryTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {dietaryTags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#FEF3C7", color: "#B45309", ...mFont }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Message au traiteur */}
            {req.message_to_caterer && (
              <p className="text-[11px] text-[#6B7280] italic border-l-2 border-[#E5E7EB] pl-2 mt-1 leading-relaxed" style={mFont}>
                &ldquo;{req.message_to_caterer}&rdquo;
              </p>
            )}

            {/* Note admin */}
            {req.super_admin_notes && (
              <div className="flex items-start gap-2 rounded-md px-2.5 py-2 mt-1" style={{ backgroundColor: "#FFF3CD" }}>
                <p className="text-[10px] font-bold text-[#B45309] shrink-0" style={mFont}>Note</p>
                <p className="text-[10px] text-[#92400E]" style={mFont}>{req.super_admin_notes}</p>
              </div>
            )}
          </div>

          {/* Séparateur vertical */}
          <div className="hidden md:block w-px self-stretch" style={{ backgroundColor: "#F3F4F6" }} />
          <div className="md:hidden h-px mx-5" style={{ backgroundColor: "#F3F4F6" }} />

          {/* Demandeur */}
          {clientUserId ? (
            <div className="md:w-[220px] md:shrink-0 p-5 flex flex-col gap-3 justify-between">
              <div className="flex flex-col gap-1">
                <p
                  className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide"
                  style={mFont}
                >
                  Demandeur
                </p>
                {req.companies?.name && (
                  <p className="text-sm font-bold text-black mt-1" style={mFont}>
                    {req.companies.name}
                  </p>
                )}
                <p className="text-xs text-[#6B7280]" style={mFont}>{clientName}</p>
              </div>
              <ContactClientButton
                adminUserId={adminUserId}
                clientUserId={clientUserId}
                clientName={clientName}
                quoteRequestId={requestId}
                existingThreadId={existingThreadId}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Rangée 2 : traiteurs + sélection côte à côte ─────── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* Traiteurs */}
        <div className="flex-1 min-w-0 bg-white rounded-lg p-6 flex flex-col gap-4">
          <div>
            <p
              className="font-display font-bold text-xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Traiteurs
            </p>
            <p className="text-xs text-[#6B7280] mt-1" style={mFont}>
              Sélectionnez jusqu&apos;à 3 traiteurs — les mieux adaptés apparaissent en premier.
            </p>
          </div>

          {isAlreadySent || isCancelled ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#6B7280]" style={mFont}>
                {isAlreadySent
                  ? "Cette demande a déjà été envoyée aux traiteurs."
                  : "Cette demande a été annulée."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedCaterers.map(cat => {
                const isSelected = selected.includes(cat.id);
                const canSelect  = isSelected || selected.length < MAX;

                const criteria = [
                  { label: "Service",      ok: cat.match.service },
                  { label: "Capacité",     ok: cat.match.capacity },
                  ...(req.dietary_vegetarian  ? [{ label: "Végétarien",  ok: cat.match.vegetarian }] : []),
                  ...(req.dietary_halal       ? [{ label: "Halal",       ok: cat.match.halal }]      : []),
                  ...(req.dietary_gluten_free ? [{ label: "Sans gluten", ok: cat.match.glutenFree }] : []),
                ];

                return (
                  <div
                    key={cat.id}
                    className="rounded-lg border transition-all"
                    style={{
                      borderColor: isSelected ? "#1A3A52" : "#F3F4F6",
                      backgroundColor: isSelected ? "#F8FAFB" : "#FFFFFF",
                      opacity: !canSelect ? 0.4 : 1,
                    }}
                  >
                    <div className="flex items-start gap-3 p-4">

                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => canSelect && toggle(cat.id)}
                        disabled={!canSelect}
                        className="mt-0.5 shrink-0"
                      >
                        {isSelected
                          ? <CheckCircle size={18} style={{ color: "#1A3A52" }} />
                          : <div className="w-[18px] h-[18px] rounded-full border-2 border-[#D1D5DB]" />
                        }
                      </button>

                      {/* Logo */}
                      {cat.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.logo_url} alt="" className="h-9 w-auto object-contain shrink-0 mt-0.5" />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold"
                          style={{ backgroundColor: "#1A3A52" }}
                        >
                          {cat.name[0]}
                        </div>
                      )}

                      {/* Nom + ville + ESAT */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-black" style={mFont}>{cat.name}</span>
                          {cat.esat_status && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                            >
                              ESAT
                            </span>
                          )}
                        </div>
                        {cat.city && (
                          <span className="flex items-center gap-0.5 text-xs text-[#6B7280] mt-0.5" style={mFont}>
                            <MapPin size={10} className="shrink-0" />
                            {cat.city}
                          </span>
                        )}
                      </div>

                      {/* Score % */}
                      <div className="shrink-0 text-right">
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: cat.scorePercent >= 80 ? "#16A34A" : cat.scorePercent >= 50 ? "#B45309" : "#DC2626",
                            ...mFont,
                          }}
                        >
                          {cat.scorePercent}%
                        </p>
                        <div className="w-16 h-1.5 rounded-full mt-1" style={{ backgroundColor: "#F3F4F6" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${cat.scorePercent}%`,
                              backgroundColor: cat.scorePercent >= 80 ? "#16A34A" : cat.scorePercent >= 50 ? "#F59E0B" : "#DC2626",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer : pastilles + voir la fiche */}
                    <div className="flex items-center gap-1.5 flex-wrap px-4 pb-3">
                      {criteria.map(c => (
                        <MatchPill key={c.label} label={c.label} ok={c.ok} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setModalCaterer(cat)}
                        className="ml-auto text-[10px] font-bold text-[#1A3A52] border border-[#E5E7EB] rounded-full px-2.5 py-0.5 hover:bg-[#F5F1E8] transition-colors shrink-0"
                        style={mFont}
                      >
                        Voir la fiche
                      </button>
                    </div>
                  </div>
                );
              })}

              {caterers.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  className="flex items-center justify-center gap-1 py-2 text-xs font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showAll
                    ? "Afficher moins"
                    : `Voir les ${caterers.length - 8} autres traiteurs`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sélection */}
        {!isAlreadySent && !isCancelled && (
          <div className="bg-white rounded-lg p-5 flex flex-col gap-4 w-full md:w-[300px] md:shrink-0">
            <p
              className="font-display font-bold text-xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Sélection
            </p>

            {/* 3 slots numérotés */}
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => {
                const cat = selectedCaterers[i];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{
                      backgroundColor: cat ? "#F0F4F7" : "#F9FAFB",
                      border: `1px solid ${cat ? "#1A3A52" : "#F3F4F6"}`,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        backgroundColor: cat ? "#1A3A52" : "#E5E7EB",
                        color: cat ? "#FFFFFF" : "#9CA3AF",
                      }}
                    >
                      {i + 1}
                    </span>
                    {cat ? (
                      <>
                        <span className="text-xs font-bold text-black flex-1 truncate" style={mFont}>
                          {cat.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(cat.id)}
                          className="shrink-0 hover:opacity-60 transition-opacity"
                        >
                          <X size={14} style={{ color: "#6B7280" }} />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[#9CA3AF]" style={mFont}>
                        Aucun traiteur sélectionné
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Note interne */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-black" style={mFont}>
                Note interne (optionnelle)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contexte, précisions pour les traiteurs…"
                rows={3}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs text-black resize-none focus:outline-none focus:border-[#1A3A52]"
                style={mFont}
              />
            </div>

            {/* Bouton envoyer */}
            <form action={approveRequestAction}>
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="notes" value={notes} />
              {selected.map(id => (
                <input key={id} type="hidden" name="caterer_ids" value={id} />
              ))}
              <button
                type="submit"
                disabled={selected.length === 0}
                className="w-full flex items-center justify-center px-4 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                style={{ backgroundColor: "#1A3A52", ...mFont }}
              >
                Envoyer aux {selected.length || "…"} traiteur{selected.length > 1 ? "s" : ""}
              </button>
            </form>

            {/* Refuser la demande */}
            <div className="border-t border-[#f2f2f2]" />
            {!showReject ? (
              <button
                type="button"
                onClick={() => setShowReject(true)}
                className="w-full px-4 py-2.5 rounded-full text-xs font-bold border border-[#DC2626] text-[#DC2626] hover:opacity-70 transition-opacity"
                style={mFont}
              >
                Refuser cette demande
              </button>
            ) : (
              <form action={rejectRequestAction} className="flex flex-col gap-3">
                <input type="hidden" name="request_id" value={requestId} />
                <input type="hidden" name="notes" value={rejectNotes} />
                <textarea
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Motif du refus (optionnel)"
                  rows={2}
                  className="w-full rounded-lg border border-[#FEE2E2] px-3 py-2 text-xs text-black resize-none focus:outline-none focus:border-[#DC2626]"
                  style={mFont}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                    style={mFont}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "#DC2626", ...mFont }}
                  >
                    Confirmer
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Modale fiche traiteur ── */}
      {modalCaterer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setModalCaterer(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6] sticky top-0 bg-white rounded-t-xl">
              <div className="flex items-center gap-3">
                {modalCaterer.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={modalCaterer.logo_url} alt="" className="h-8 w-auto object-contain" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: "#1A3A52" }}
                  >
                    {modalCaterer.name[0]}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-black" style={mFont}>{modalCaterer.name}</p>
                    {modalCaterer.esat_status && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                      >
                        ESAT
                      </span>
                    )}
                  </div>
                  {modalCaterer.city && (
                    <p className="text-xs text-[#6B7280]" style={mFont}>{modalCaterer.city}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCaterer(null)}
                className="hover:opacity-60 transition-opacity shrink-0"
              >
                <X size={18} style={{ color: "#6B7280" }} />
              </button>
            </div>

            {/* Corps */}
            <div className="p-5 flex flex-col gap-5">

              {/* Score */}
              <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ backgroundColor: "#F9FAFB" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-black" style={mFont}>Score de correspondance</p>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: modalCaterer.scorePercent >= 80 ? "#16A34A" : modalCaterer.scorePercent >= 50 ? "#B45309" : "#DC2626",
                      ...mFont,
                    }}
                  >
                    {modalCaterer.scorePercent}%
                  </p>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${modalCaterer.scorePercent}%`,
                      backgroundColor: modalCaterer.scorePercent >= 80 ? "#16A34A" : modalCaterer.scorePercent >= 50 ? "#F59E0B" : "#DC2626",
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              {modalCaterer.description && (
                <p className="text-xs text-[#444] leading-relaxed" style={mFont}>
                  {modalCaterer.description}
                </p>
              )}

              {/* Infos pratiques */}
              <div className="flex flex-col gap-2.5">
                {(modalCaterer.address || modalCaterer.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin size={13} className="text-[#6B7280] shrink-0 mt-0.5" />
                    <p className="text-xs text-black" style={mFont}>
                      {[modalCaterer.address, modalCaterer.zip_code, modalCaterer.city].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {modalCaterer.delivery_radius_km && (
                  <div className="flex items-start gap-2">
                    <Truck size={13} className="text-[#6B7280] shrink-0 mt-0.5" />
                    <p className="text-xs text-black" style={mFont}>
                      Livraison dans un rayon de {modalCaterer.delivery_radius_km} km
                    </p>
                  </div>
                )}
                {(modalCaterer.capacity_min || modalCaterer.capacity_max) && (
                  <div className="flex items-start gap-2">
                    <Users size={13} className="text-[#6B7280] shrink-0 mt-0.5" />
                    <p className="text-xs text-black" style={mFont}>
                      {modalCaterer.capacity_min && modalCaterer.capacity_max
                        ? `${modalCaterer.capacity_min} à ${modalCaterer.capacity_max} personnes`
                        : modalCaterer.capacity_min
                        ? `À partir de ${modalCaterer.capacity_min} personnes`
                        : `Jusqu'à ${modalCaterer.capacity_max} personnes`}
                    </p>
                  </div>
                )}
              </div>

              {/* Spécialités */}
              {modalCaterer.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {modalCaterer.specialties.map((s: string) => (
                    <span
                      key={s}
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: "#F5F1E8", color: "#1A3A52", ...mFont }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#F3F4F6] flex gap-2 sticky bottom-0 bg-white rounded-b-xl">
              <button
                type="button"
                onClick={() => setModalCaterer(null)}
                className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-[#1A3A52] border border-[#1A3A52] hover:bg-[#F5F1E8] transition-colors"
                style={mFont}
              >
                Fermer
              </button>
              {selected.includes(modalCaterer.id) ? (
                <button
                  type="button"
                  onClick={() => { remove(modalCaterer.id); setModalCaterer(null); }}
                  className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold border border-[#DC2626] text-[#DC2626] hover:opacity-70 transition-opacity"
                  style={mFont}
                >
                  Retirer
                </button>
              ) : selected.length < MAX ? (
                <button
                  type="button"
                  onClick={() => { toggle(modalCaterer.id); setModalCaterer(null); }}
                  className="flex-1 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#1A3A52", ...mFont }}
                >
                  Sélectionner
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sous-composants ────────────────────────────────────────────

function MatchPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: ok ? "#DCFCE7" : "#FEE2E2",
        color: ok ? "#16A34A" : "#DC2626",
        fontFamily: "Marianne, system-ui, sans-serif",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: ok ? "#16A34A" : "#DC2626" }}
      />
      {label}
    </span>
  );
}

function InlineRow({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wide block" style={mFont}>
        {label}
      </span>
      <span className="text-xs font-bold text-black" style={mFont}>{value}</span>
    </div>
  );
}
