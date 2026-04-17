import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Truck, Users } from "lucide-react";
import type { Caterer, ServiceTypeConfig } from "@/types/database";
import CatererPhotoGallery from "@/components/client/CatererPhotoGallery";
import BackButton from "@/components/ui/BackButton";

// ── Constants ──────────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: "petit_dejeuner",        label: "Petit déjeuner",        img: "/images/type-prestation-a.png" },
  { key: "pause_gourmande",       label: "Pause gourmande",       img: "/images/type-prestation-b.png" },
  { key: "plateaux_repas",        label: "Plateaux repas",        img: "/images/type-prestation-c.png" },
  { key: "cocktail_dinatoire",    label: "Cocktail dinatoire",    img: "/images/type-prestation-d.png" },
  { key: "cocktail_dejeunatoire", label: "Cocktail déjeunatoire", img: "/images/type-prestation-d.png" },
  { key: "cocktail_aperitif",     label: "Cocktail apéritif",     img: "/images/type-prestation-b.png" },
];

const DIET_LABELS = [
  { key: "dietary_vegetarian" as keyof Caterer, label: "Végétarien" },
  { key: "dietary_gluten_free" as keyof Caterer, label: "Sans gluten" },
  { key: "dietary_halal"       as keyof Caterer, label: "Halal" },
  { key: "dietary_bio"         as keyof Caterer, label: "Bio" },
];

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

// ── Page ───────────────────────────────────────────────────────

export default async function CatererDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("caterers")
    .select("*")
    .eq("id", id)
    .eq("is_validated", true)
    .single();

  if (!data) notFound();

  const caterer = data as Caterer;
  const serviceConfig = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;

  const enabledServices = SERVICE_TYPES.filter(({ key }) => serviceConfig[key]?.enabled);

  const prices = enabledServices
    .map(({ key }) => serviceConfig[key]?.price_per_person_min)
    .filter((v): v is number => v != null && v > 0);

  const capacities = enabledServices
    .map(({ key }) => serviceConfig[key]?.capacity_min)
    .filter((v): v is number => v != null && v > 0);

  const maxCapacities = enabledServices
    .map(({ key }) => serviceConfig[key]?.capacity_max)
    .filter((v): v is number => v != null && v > 0);

  const minPrice    = prices.length      ? Math.min(...prices)       : null;
  const minCapacity = capacities.length  ? Math.min(...capacities)   : null;
  const maxCapacity = maxCapacities.length ? Math.max(...maxCapacities) : null;

  const activeDiets = DIET_LABELS.filter(({ key }) => caterer[key]);

  const showPractical =
    caterer.address || caterer.city || caterer.delivery_radius_km || minCapacity;

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton />

          {/* ── Hero : photos + carte info ── */}
        <div className="flex flex-col md:flex-row gap-5 items-start">

          {/* Photos */}
          <CatererPhotoGallery photos={caterer.photos} catererName={caterer.name} />

          {/* Carte info */}
          <div
            className="bg-white rounded-lg p-6 flex flex-col gap-5 w-full shrink-0"
            style={{ maxWidth: 340 }}
          >
            {/* Logo + nom */}
            <div className="flex flex-col gap-2">
              {caterer.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={caterer.logo_url}
                  alt="Logo"
                  className="h-8 w-auto object-contain self-start"
                />
              )}
              <p
                className="font-display font-bold text-2xl text-black leading-tight"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {caterer.name}
              </p>
              {(caterer.city || caterer.zip_code) && (
                <p className="text-xs text-[#313131]" style={mFont}>
                  {[caterer.city, caterer.zip_code ? `(${caterer.zip_code.slice(0, 2)})` : null]
                    .filter(Boolean)
                    .join(" ")}
                  {caterer.delivery_radius_km
                    ? ` — rayon ${caterer.delivery_radius_km} km`
                    : ""}
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
                <span className="text-xs text-[#9CA3AF]" style={mFont}>
                  Aucun avis
                </span>
              </div>
            </div>

            {/* Description */}
            {caterer.description && (
              <p className="text-xs text-[#313131] leading-relaxed" style={mFont}>
                {caterer.description}
              </p>
            )}

            {/* Prix / capacité */}
            {(minPrice || minCapacity) && (
              <div className="flex gap-4">
                {minPrice && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] text-[#313131]" style={mFont}>
                      Prix minimum par personne
                    </p>
                    <p className="font-bold text-base text-black" style={mFont}>
                      {minPrice} €
                    </p>
                  </div>
                )}
                {minCapacity && (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[10px] text-[#313131]" style={mFont}>
                      Minimum d&apos;invités
                    </p>
                    <p className="font-bold text-base text-black" style={mFont}>
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
                    style={{ ...mFont, backgroundColor: "#DCFCE7", color: "#16A34A" }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <Link
              href={`/client/requests/new?caterer_id=${caterer.id}`}
              className="w-full flex items-center justify-center px-6 py-3 rounded-full text-white text-xs font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#1A3A52", ...mFont }}
            >
              Demander un devis
            </Link>
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
                const cfg = serviceConfig[key];
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
                      <p className="text-xs font-bold text-black" style={mFont}>
                        {label}
                      </p>
                      {cfg.price_per_person_min && (
                        <p
                          className="text-xs font-bold"
                          style={{ ...mFont, color: "#1A3A52" }}
                        >
                          à partir de {cfg.price_per_person_min} € / pers
                        </p>
                      )}
                      {cfg.capacity_min && (
                        <p className="text-[10px] text-[#313131]" style={mFont}>
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
        {showPractical && (
          <div className="bg-white rounded-lg p-6">
            <h2
              className="font-display font-bold text-2xl text-black mb-4"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Informations pratiques
            </h2>
            <div className="flex flex-col gap-3">
              {(caterer.address || caterer.city) && (
                <div className="flex gap-2 items-center">
                  <MapPin size={16} className="text-[#313131] shrink-0" />
                  <p className="text-xs text-black" style={mFont}>
                    {[caterer.address, caterer.zip_code, caterer.city]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
              {caterer.delivery_radius_km && (
                <div className="flex gap-2 items-center">
                  <Truck size={16} className="text-[#313131] shrink-0" />
                  <p className="text-xs text-black" style={mFont}>
                    Livraison dans un rayon de {caterer.delivery_radius_km} km
                  </p>
                </div>
              )}
              {(minCapacity || maxCapacity) && (
                <div className="flex gap-2 items-center">
                  <Users size={16} className="text-[#313131] shrink-0" />
                  <p className="text-xs text-black" style={mFont}>
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
            <p className="text-sm font-bold text-black" style={mFont}>
              Aucun avis pour le moment
            </p>
            <p className="text-xs text-[#9CA3AF] text-center" style={mFont}>
              Les avis clients apparaîtront ici après les premières prestations.
            </p>
          </div>
        </div>

        </div>
      </div>
    </main>
  );
}
