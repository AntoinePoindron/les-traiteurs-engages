import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/ui/BackButton";
import type { Caterer, ServiceTypeConfig } from "@/types/database";
import { validateCatererAction, rejectCatererAction } from "../actions";
import {
  MapPin, Truck, Users, CheckCircle, Clock, ChefHat,
  Building2, Euro, Percent,
} from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const SERVICE_LABELS: Record<string, string> = {
  petit_dejeuner:        "Petit déjeuner",
  pause_gourmande:       "Pause gourmande",
  plateaux_repas:        "Plateaux repas",
  cocktail_dinatoire:    "Cocktail dinatoire",
  cocktail_dejeunatoire: "Cocktail déjeunatoire",
  cocktail_aperitif:     "Cocktail apéritif",
  dejeuner:              "Déjeuner",
  diner:                 "Dîner",
  cocktail:              "Cocktail",
  autre:                 "Autre",
};

const DIET_LABELS = [
  { key: "dietary_vegetarian" as keyof Caterer, label: "Végétarien" },
  { key: "dietary_halal"       as keyof Caterer, label: "Halal" },
  { key: "dietary_gluten_free" as keyof Caterer, label: "Sans gluten" },
  { key: "dietary_bio"         as keyof Caterer, label: "Bio" },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCatererDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("caterers")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  const caterer = data as Caterer;

  // ── Contact (user linked to this caterer) ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRow } = await (supabase as any)
    .from("users")
    .select("first_name, last_name, email")
    .eq("caterer_id", id)
    .limit(1)
    .maybeSingle();

  const contactName = userRow
    ? `${userRow.first_name ?? ""} ${userRow.last_name ?? ""}`.trim() || userRow.email
    : null;
  const contactEmail = userRow?.email ?? null;

  // ── Services ────────────────────────────────────────────────
  const serviceConfig = (caterer.service_config ?? {}) as Record<string, ServiceTypeConfig>;
  const enabledServices = Object.entries(serviceConfig)
    .filter(([, cfg]) => cfg.enabled)
    .map(([key, cfg]) => ({ key, label: SERVICE_LABELS[key] ?? key, cfg }));

  const activeDiets = DIET_LABELS.filter(({ key }) => caterer[key]);

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "1020px" }}>

          <BackButton label="Retour" />

          {/* Titre */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {caterer.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={caterer.logo_url}
                  alt=""
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#E5EDF2" }}
                >
                  <ChefHat size={20} style={{ color: "#1A3A52" }} />
                </div>
              )}
              <h1
                className="font-display font-bold text-4xl text-black"
                style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
              >
                {caterer.name}
              </h1>
              {caterer.esat_status && (
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded"
                  style={{ backgroundColor: "#DCFCE7", color: "#16A34A", ...mFont }}
                >
                  ESAT
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {caterer.is_validated ? (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#16A34A", ...mFont }}>
                  <CheckCircle size={13} />
                  Compte validé
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#B45309", ...mFont }}>
                  <Clock size={13} />
                  En attente de validation
                </span>
              )}
              <span className="text-xs text-[#9CA3AF]" style={mFont}>
                Inscrit le {new Date(caterer.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">

            {/* ── Colonne gauche : profil ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">

              {/* Contact */}
              {(contactName || contactEmail) && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Contact
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#F5F1E8" }}>
                      <Building2 size={16} style={{ color: "#1A3A52" }} />
                    </div>
                    <div>
                      {contactName && (
                        <p className="text-sm font-bold text-black" style={mFont}>{contactName}</p>
                      )}
                      {contactEmail && (
                        <p className="text-xs text-[#6B7280]" style={mFont}>{contactEmail}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informations générales */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Informations
                </p>

                {caterer.description && (
                  <p className="text-xs text-[#444] leading-relaxed" style={mFont}>
                    {caterer.description}
                  </p>
                )}

                <div className="flex flex-col gap-2.5">
                  {(caterer.address || caterer.city) && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-[#6B7280] shrink-0 mt-0.5" />
                      <p className="text-xs text-black" style={mFont}>
                        {[caterer.address, caterer.zip_code, caterer.city].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  {caterer.delivery_radius_km && (
                    <div className="flex items-start gap-2">
                      <Truck size={14} className="text-[#6B7280] shrink-0 mt-0.5" />
                      <p className="text-xs text-black" style={mFont}>
                        Livraison dans un rayon de {caterer.delivery_radius_km} km
                      </p>
                    </div>
                  )}
                  {(caterer.capacity_min || caterer.capacity_max) && (
                    <div className="flex items-start gap-2">
                      <Users size={14} className="text-[#6B7280] shrink-0 mt-0.5" />
                      <p className="text-xs text-black" style={mFont}>
                        {caterer.capacity_min && caterer.capacity_max
                          ? `${caterer.capacity_min} à ${caterer.capacity_max} personnes`
                          : caterer.capacity_min
                          ? `À partir de ${caterer.capacity_min} personnes`
                          : `Jusqu'à ${caterer.capacity_max} personnes`}
                      </p>
                    </div>
                  )}
                  {caterer.siret && (
                    <InfoRow label="SIRET" value={caterer.siret} />
                  )}
                  <InfoRow label="Commission" value={`${caterer.commission_rate} %`} />
                </div>

                {/* Régimes */}
                {activeDiets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
              </div>

              {/* Services */}
              {enabledServices.length > 0 && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Types de prestations
                  </p>
                  <div className="flex flex-col divide-y divide-[#F3F4F6]">
                    {enabledServices.map(({ key, label, cfg }) => (
                      <div key={key} className="py-2.5 flex items-center justify-between gap-4">
                        <p className="text-xs font-bold text-black" style={mFont}>{label}</p>
                        <div className="flex items-center gap-3 text-xs text-[#6B7280] shrink-0" style={mFont}>
                          {cfg.capacity_min && (
                            <span>{cfg.capacity_min}–{cfg.capacity_max ?? "∞"} pers</span>
                          )}
                          {cfg.price_per_person_min && (
                            <span className="font-bold text-[#1A3A52]">
                              {cfg.price_per_person_min} €/pers
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {caterer.photos && caterer.photos.length > 0 && (
                <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                  <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                    Photos
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {caterer.photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="w-full aspect-video object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite : actions admin ── */}
            <div
              className="bg-white rounded-lg p-6 flex flex-col gap-5 w-full md:w-[300px] md:shrink-0"
            >
              <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                Actions admin
              </p>

              {caterer.is_validated ? (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#DCFCE7" }}>
                    <CheckCircle size={15} style={{ color: "#16A34A" }} />
                    <p className="text-xs font-bold" style={{ color: "#16A34A", ...mFont }}>
                      Ce compte est validé
                    </p>
                  </div>
                  <div className="border-t border-[#f2f2f2]" />
                  <form action={rejectCatererAction}>
                    <input type="hidden" name="caterer_id" value={caterer.id} />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors"
                      style={mFont}
                    >
                      Désactiver ce compte
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#FFF3CD" }}>
                    <Clock size={15} style={{ color: "#B45309" }} />
                    <p className="text-xs font-bold" style={{ color: "#B45309", ...mFont }}>
                      En attente de validation
                    </p>
                  </div>
                  <form action={validateCatererAction}>
                    <input type="hidden" name="caterer_id" value={caterer.id} />
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "#1A3A52", ...mFont }}
                    >
                      <CheckCircle size={16} />
                      Valider ce compte
                    </button>
                  </form>
                  <div className="border-t border-[#f2f2f2]" />
                  <form action={rejectCatererAction}>
                    <input type="hidden" name="caterer_id" value={caterer.id} />
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-full text-xs font-bold text-[#DC2626] border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors"
                      style={mFont}
                    >
                      Refuser ce compte
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[#6B7280]" style={mFont}>{label}</span>
      <span className="text-xs font-bold text-black" style={mFont}>{value}</span>
    </div>
  );
}
