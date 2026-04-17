"use client";

import { useState } from "react";
import { X, MapPin, Truck, Users, ArrowLeft } from "lucide-react";
import type { ServiceConfig } from "@/app/(dashboard)/caterer/profile/actions";

// ── Types ─────────────────────────────────────────────────────

export type PreviewData = {
  name: string;
  esatStatus: boolean;
  address: string;
  city: string;
  zipCode: string;
  description: string;
  logoUrl: string | null;
  deliveryRadius: number | null;
  serviceConfig: Record<string, ServiceConfig>;
  photos: string[];
  dietVegetarian: boolean;
  dietGlutenFree: boolean;
  dietHalal: boolean;
  dietBio: boolean;
};

// ── Constants ─────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: "petit_dejeuner",        label: "Petit déjeuner",         img: "/images/type-prestation-a.png" },
  { key: "pause_gourmande",       label: "Pause gourmande",        img: "/images/type-prestation-b.png" },
  { key: "plateaux_repas",        label: "Plateaux repas",         img: "/images/type-prestation-c.png" },
  { key: "cocktail_dinatoire",    label: "Cocktail dinatoire",     img: "/images/type-prestation-d.png" },
  { key: "cocktail_dejeunatoire", label: "Cocktail déjeunatoire",  img: "/images/type-prestation-d.png" },
  { key: "cocktail_aperitif",     label: "Cocktail apéritif",      img: "/images/type-prestation-b.png" },
];

const DIET_LABELS: { key: keyof PreviewData; label: string }[] = [
  { key: "dietVegetarian", label: "Végétarien" },
  { key: "dietGlutenFree", label: "Sans gluten" },
  { key: "dietHalal",      label: "Halal" },
  { key: "dietBio",        label: "Bio" },
];

// ── Component ─────────────────────────────────────────────────

export default function CatererProfilePreviewModal({
  data,
  onClose,
}: {
  data: PreviewData;
  onClose: () => void;
}) {
  const enabledServices = SERVICE_TYPES.filter(
    ({ key }) => data.serviceConfig[key]?.enabled
  );

  const prices = enabledServices
    .map(({ key }) => data.serviceConfig[key]?.price_per_person_min)
    .filter((v): v is number => v != null && v > 0);

  const capacities = enabledServices
    .map(({ key }) => data.serviceConfig[key]?.capacity_min)
    .filter((v): v is number => v != null && v > 0);

  const maxCapacities = enabledServices
    .map(({ key }) => data.serviceConfig[key]?.capacity_max)
    .filter((v): v is number => v != null && v > 0);

  const minPrice = prices.length ? Math.min(...prices) : null;
  const minCapacity = capacities.length ? Math.min(...capacities) : null;
  const maxCapacity = maxCapacities.length ? Math.max(...maxCapacities) : null;

  const activeDiets = DIET_LABELS.filter(({ key }) => data[key]);

  const photo1 = data.photos[0] ?? null;
  const photo2 = data.photos[1] ?? null;
  const photo3 = data.photos[2] ?? null;

  const [showAllPhotos, setShowAllPhotos] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-auto my-8 rounded-xl overflow-hidden"
        style={{ width: 1020, maxWidth: "calc(100vw - 32px)", backgroundColor: "#F5F1E8" }}
      >
        {/* ── Barre fermeture (sticky) ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-[#E5E7EB]"
          style={{ backgroundColor: "rgba(255,255,255,0.97)", backdropFilter: "blur(4px)" }}
        >
          {showAllPhotos ? (
            <button
              onClick={() => setShowAllPhotos(false)}
              className="flex items-center gap-2 text-sm font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              <ArrowLeft size={16} />
              Retour à la fiche
            </button>
          ) : (
            <p
              className="text-sm font-bold"
              style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#1A3A52" }}
            >
              Prévisualisation de votre fiche publique
            </p>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#1A3A52] text-xs font-bold text-[#1A3A52] hover:bg-gray-50 transition-colors"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            <X size={13} />
            Fermer la prévisualisation
          </button>
        </div>

        {/* ── Vue galerie complète ── */}
        {showAllPhotos && (
          <div className="px-6 py-8">
            <h2
              className="font-display font-bold text-2xl text-black mb-6"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Toutes les photos ({data.photos.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url + i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full rounded-lg object-cover"
                  style={{ height: 220 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Contenu principal ── */}
        <div className={`px-6 pb-10 pt-6 flex flex-col gap-6${showAllPhotos ? " hidden" : ""}`}>

          {/* ── Bloc hero : photos + carte info ── */}
          <div className="flex flex-col md:flex-row gap-5 items-start">

            {/* Photos */}
            <div className="flex gap-3 flex-1 min-w-0">
              {/* Grande photo */}
              <div
                className="rounded-lg overflow-hidden bg-[#E5E7EB] relative"
                style={{ flex: "2 2 0%", height: 360 }}
              >
                {photo1 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo1} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div className="flex items-center justify-center" style={{ width: "100%", height: "100%" }}>
                    <p className="text-xs text-[#9CA3AF]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                      Aucune photo
                    </p>
                  </div>
                )}
                {data.photos.length > 3 && (
                  <button
                    onClick={() => setShowAllPhotos(true)}
                    className="absolute bottom-3 left-3 bg-white/90 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition-colors"
                  >
                    <p className="text-xs font-bold text-navy" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                      Tout voir ({data.photos.length})
                    </p>
                  </button>
                )}
              </div>

              {/* Deux petites photos */}
              <div className="flex flex-col gap-3" style={{ flex: "1 1 0%", height: 360 }}>
                <div
                  className="rounded-lg overflow-hidden bg-[#E5E7EB]"
                  style={{ height: 174 }}
                >
                  {photo2 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo2} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </div>
                <div
                  className="rounded-lg overflow-hidden bg-[#E5E7EB]"
                  style={{ height: 174 }}
                >
                  {photo3 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo3} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </div>
              </div>
            </div>

            {/* Carte info */}
            <div
              className="bg-white rounded-lg p-6 flex flex-col gap-5 w-full shrink-0"
              style={{ maxWidth: 340 }}
            >
                {/* Logo + nom */}
                <div className="flex flex-col gap-2">
                  {data.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.logoUrl} alt="Logo" className="h-8 w-auto max-w-[160px] object-contain self-start" />
                  )}
                  <p
                    className="font-display font-bold text-2xl text-black leading-tight"
                    style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
                  >
                    {data.name || "Nom de la structure"}
                  </p>
                  {(data.city || data.zipCode) && (
                    <p
                      className="text-xs text-[#313131]"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {[data.city, data.zipCode ? `(${data.zipCode.slice(0, 2)})` : null]
                        .filter(Boolean)
                        .join(" ")}
                      {data.deliveryRadius ? ` — rayon ${data.deliveryRadius} km` : ""}
                    </p>
                  )}

                  {/* Étoiles + note */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                            stroke="#D1D5DB"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ))}
                    </div>
                    <span
                      className="text-xs text-[#9CA3AF]"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Aucun avis
                    </span>
                  </div>
                </div>

                {/* Description */}
                {data.description && (
                  <p
                    className="text-xs text-[#313131] leading-relaxed"
                    style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                  >
                    {data.description}
                  </p>
                )}

                {/* Prix / capacité */}
                {(minPrice || minCapacity) && (
                  <div className="flex gap-4">
                    {minPrice && (
                      <div className="flex flex-col gap-0.5">
                        <p
                          className="text-[10px] text-[#313131]"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          Prix minimum par personne
                        </p>
                        <p
                          className="font-bold text-base text-black"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {minPrice} €
                        </p>
                      </div>
                    )}
                    {minCapacity && (
                      <div className="flex flex-col gap-0.5">
                        <p
                          className="text-[10px] text-[#313131]"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          Minimum d&apos;invités
                        </p>
                        <p
                          className="font-bold text-base text-black"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {minCapacity} personnes
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Régimes */}
                {activeDiets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeDiets.map(({ label }) => (
                      <span
                        key={label}
                        className="px-2 py-1 rounded text-xs font-bold"
                        style={{
                          fontFamily: "Marianne, system-ui, sans-serif",
                          backgroundColor: "#DCFCE7",
                          color: "#16A34A",
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA désactivé */}
                <div
                  className="w-full flex items-center justify-center px-6 py-3 rounded-full text-white text-xs font-bold opacity-50 cursor-not-allowed select-none"
                  style={{
                    backgroundColor: "#1A3A52",
                    fontFamily: "Marianne, system-ui, sans-serif",
                  }}
                >
                  Demander un devis
                </div>
            </div>
          </div>

          {/* ── Types de prestation ── */}
          {enabledServices.length > 0 && (
            <div className="bg-white rounded-lg p-6">
              <h2
                className="font-display font-bold text-2xl text-black mb-5"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Types de prestations
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {enabledServices.map(({ key, label, img }) => {
                  const cfg = data.serviceConfig[key];
                  return (
                    <div key={key} className="flex gap-2 items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt=""
                        className="shrink-0 object-contain opacity-30"
                        style={{ width: 64, height: 48 }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <p
                          className="text-xs font-bold text-black"
                          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                        >
                          {label}
                        </p>
                        {cfg.price_per_person_min && (
                          <p
                            className="text-xs font-bold"
                            style={{ fontFamily: "Marianne, system-ui, sans-serif", color: "#1A3A52" }}
                          >
                            à partir de {cfg.price_per_person_min} € / pers
                          </p>
                        )}
                        {cfg.capacity_min && (
                          <p
                            className="text-[10px] text-[#313131]"
                            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                          >
                            Minimum {cfg.capacity_min} personnes
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Informations pratiques ── */}
          {(data.address || data.city || data.deliveryRadius || minCapacity) && (
            <div className="bg-white rounded-lg p-6">
              <h2
                className="font-display font-bold text-2xl text-black mb-4"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                Informations pratiques
              </h2>
              <div className="flex flex-col gap-3">
                {(data.address || data.city) && (
                  <div className="flex gap-2 items-center">
                    <MapPin size={16} className="text-[#313131] shrink-0" />
                    <p
                      className="text-xs text-black"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {[data.address, data.zipCode, data.city].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}
                {data.deliveryRadius && (
                  <div className="flex gap-2 items-center">
                    <Truck size={16} className="text-[#313131] shrink-0" />
                    <p
                      className="text-xs text-black"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Livraison dans un rayon de {data.deliveryRadius} km
                    </p>
                  </div>
                )}
                {(minCapacity || maxCapacity) && (
                  <div className="flex gap-2 items-center">
                    <Users size={16} className="text-[#313131] shrink-0" />
                    <p
                      className="text-xs text-black"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      {minCapacity && maxCapacity
                        ? `${minCapacity} à ${maxCapacity} personnes`
                        : minCapacity
                        ? `À partir de ${minCapacity} personnes`
                        : `Jusqu'à ${maxCapacity} personnes`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Avis clients ── */}
          <div className="bg-white rounded-lg p-6">
            <h2
              className="font-display font-bold text-2xl text-black mb-5"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Avis clients
            </h2>
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                      stroke="#D1D5DB"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ))}
              </div>
              <p
                className="text-sm font-bold text-black"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Aucun avis pour le moment
              </p>
              <p
                className="text-xs text-[#9CA3AF] text-center"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Les avis clients apparaîtront ici après vos premières prestations.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
