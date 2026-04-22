"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  photos: string[];
  catererName: string;
}

export default function CatererPhotoGallery({ photos, catererName }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const photo1 = photos[0] ?? null;
  const photo2 = photos[1] ?? null;
  const photo3 = photos[2] ?? null;

  function open(index: number) {
    setLightboxIndex(index);
  }

  function close() {
    setLightboxIndex(null);
  }

  function prev() {
    setLightboxIndex((i) => (i === null ? 0 : (i - 1 + photos.length) % photos.length));
  }

  function next() {
    setLightboxIndex((i) => (i === null ? 0 : (i + 1) % photos.length));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft")  prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape")     close();
  }

  return (
    <>
      {/* ── Grille de photos ── */}
      <div className="flex gap-3 flex-1 min-w-0">
        {/* Grande photo */}
        <div
          className="rounded-lg overflow-hidden bg-[#E5E7EB] relative group"
          style={{ flex: "2 2 0%", height: 360 }}
        >
          {photo1 ? (
            <button
              onClick={() => open(0)}
              className="w-full h-full block focus:outline-none cursor-pointer"
              aria-label="Agrandir la photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo1}
                alt={catererName}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </button>
          ) : (
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/caterer-photo-placeholder.png"
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <p
                  className="px-3 py-1.5 rounded-full bg-white/85 text-xs font-bold text-[#6B7280]"
                  style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                >
                  Aucune photo
                </p>
              </div>
            </div>
          )}

          {photos.length > 3 && (
            <button
              onClick={() => open(0)}
              className="absolute bottom-3 left-3 bg-white/90 px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition-colors"
            >
              <p
                className="text-xs font-bold text-[#1A3A52]"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Voir toutes les photos ({photos.length})
              </p>
            </button>
          )}
        </div>

        {/* Deux petites photos */}
        <div className="flex flex-col gap-3" style={{ flex: "1 1 0%", height: 360 }}>
          {[photo2, photo3].map((photo, idx) => (
            <div
              key={idx}
              className="rounded-lg overflow-hidden bg-[#E5E7EB] group relative"
              style={{ height: 174 }}
            >
              {photo ? (
                <button
                  onClick={() => open(idx + 1)}
                  className="w-full h-full block focus:outline-none cursor-pointer"
                  aria-label="Agrandir la photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/images/caterer-photo-placeholder.png"
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center"
          onClick={close}
          onKeyDown={onKeyDown}
          tabIndex={0}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          role="dialog"
          aria-modal="true"
          aria-label="Galerie photos"
          style={{ outline: "none" }}
        >
          {/* Fermer */}
          <button
            onClick={close}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-white" />
          </button>

          {/* Compteur */}
          <p
            className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {lightboxIndex + 1} / {photos.length}
          </p>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Photo précédente"
            >
              <ChevronLeft size={22} className="text-white" />
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl"
            />
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Photo suivante"
            >
              <ChevronRight size={22} className="text-white" />
            </button>
          )}

          {/* Miniatures */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {photos.map((url, i) => (
                <button
                  key={url + i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className="rounded overflow-hidden transition-opacity"
                  style={{ opacity: i === lightboxIndex ? 1 : 0.45 }}
                  aria-label={`Aller à la photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="object-cover"
                    style={{ width: 48, height: 36 }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
