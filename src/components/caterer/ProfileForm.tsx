"use client";

import { useState, useRef, useTransition } from "react";
import { Upload, Trash2, Plus, Check, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateCatererProfile } from "@/app/(dashboard)/caterer/profile/actions";
import type { Caterer } from "@/types/database";
import type { ServiceConfig } from "@/app/(dashboard)/caterer/profile/actions";
import CatererProfilePreviewModal from "@/components/caterer/CatererProfilePreviewModal";

// ── Service types ─────────────────────────────────────────────

const SERVICE_TYPES = [
  { key: "petit_dejeuner",        label: "Petit déjeuner" },
  { key: "pause_gourmande",       label: "Pause gourmande" },
  { key: "plateaux_repas",        label: "Plateaux repas" },
  { key: "cocktail_dinatoire",    label: "Cocktail dinatoire" },
  { key: "cocktail_dejeunatoire", label: "Cocktail déjeunatoire" },
  { key: "cocktail_aperitif",     label: "Cocktail apéritif" },
] as const;

function defaultServiceConfig(): Record<string, ServiceConfig> {
  return Object.fromEntries(
    SERVICE_TYPES.map(({ key }) => [key, { enabled: false }])
  );
}

// ── Toggle switch ─────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none"
      style={{ backgroundColor: checked ? "#1A3A52" : "#D1D5DB" }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── Section card wrapper ──────────────────────────────────────

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg p-6 flex flex-col gap-5 ${className ?? ""}`}>
      <h2
        className="font-display font-bold text-2xl text-black"
        style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Field label + input wrapper ───────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-bold text-black"
        style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-navy transition-colors bg-white";
const inputStyle = { fontFamily: "Marianne, system-ui, sans-serif", color: "#1A1A1A" };

// ── Service type row ──────────────────────────────────────────

function ServiceTypeRow({
  label,
  config,
  onChange,
}: {
  label: string;
  config: ServiceConfig;
  onChange: (c: ServiceConfig) => void;
}) {
  const set = (field: keyof ServiceConfig, value: unknown) =>
    onChange({ ...config, [field]: value === "" ? null : value });

  return (
    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#FAFAFA]">
        <span
          className="text-sm font-bold text-black"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          {label}
        </span>
        <Toggle
          checked={config.enabled}
          onChange={(v) => onChange({ ...config, enabled: v })}
        />
      </div>

      {/* Expanded fields */}
      {config.enabled && (
        <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-[#E5E7EB]">
          <Field label="Capacité min (couverts)">
            <input
              type="number"
              min={0}
              value={config.capacity_min ?? ""}
              onChange={(e) => set("capacity_min", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex. 10"
            />
          </Field>
          <Field label="Capacité max (couverts)">
            <input
              type="number"
              min={0}
              value={config.capacity_max ?? ""}
              onChange={(e) => set("capacity_max", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex. 100"
            />
          </Field>
          <Field label="Tarif / personne min (€)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={config.price_per_person_min ?? ""}
              onChange={(e) => set("price_per_person_min", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex. 8.50"
            />
          </Field>
          <Field label="Montant global min (€)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={config.global_min ?? ""}
              onChange={(e) => set("global_min", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex. 150"
            />
          </Field>
          <Field label="Délai minimum (jours)">
            <input
              type="number"
              min={0}
              value={config.lead_time_days ?? ""}
              onChange={(e) => set("lead_time_days", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex. 3"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface ProfileFormProps {
  caterer: Caterer;
  catererId: string;
}

export default function ProfileForm({ caterer, catererId }: ProfileFormProps) {
  const supabase = useRef(createClient());
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(caterer.name);
  const [esatStatus, setEsatStatus] = useState(caterer.esat_status);
  const [address, setAddress] = useState(caterer.address ?? "");
  const [city, setCity] = useState(caterer.city ?? "");
  const [zipCode, setZipCode] = useState(caterer.zip_code ?? "");
  const [description, setDescription] = useState(caterer.description ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(caterer.logo_url ?? null);
  const [deliveryRadius, setDeliveryRadius] = useState<number | null>(
    caterer.delivery_radius_km ?? null
  );
  const [dietVegetarian, setDietVegetarian] = useState(caterer.dietary_vegetarian ?? false);
  const [dietGlutenFree, setDietGlutenFree] = useState(caterer.dietary_gluten_free ?? false);
  const [dietHalal, setDietHalal] = useState(caterer.dietary_halal ?? false);
  const [dietBio, setDietBio] = useState(caterer.dietary_bio ?? false);
  const [serviceConfig, setServiceConfig] = useState<Record<string, ServiceConfig>>(() => {
    const base = defaultServiceConfig();
    const existing = (caterer.service_config as Record<string, ServiceConfig>) ?? {};
    return { ...base, ...existing };
  });
  const [photos, setPhotos] = useState<string[]>(caterer.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // ── File upload helpers ───────────────────────────────────────

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { data, error } = await supabase.current.storage
      .from("caterer-assets")
      .upload(path, file, { upsert: true });
    if (error || !data) return null;
    const { data: urlData } = supabase.current.storage
      .from("caterer-assets")
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${catererId}/logo/${Date.now()}_${file.name}`;
    const url = await uploadFile(file, path);
    if (url) setLogoUrl(url);
    setUploading(false);
    e.target.value = "";
  }

  async function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${catererId}/photos/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path);
      if (url) newUrls.push(url);
    }
    setPhotos((prev) => [...prev, ...newUrls]);
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Drag to reorder ──────────────────────────────────────────

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) {
      setDragOverIndex(null);
      dragIndex.current = null;
      return;
    }
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current!, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  // ── Save ──────────────────────────────────────────────────────

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateCatererProfile({
        name,
        esat_status: esatStatus,
        address,
        city,
        zip_code: zipCode,
        description,
        logo_url: logoUrl,
        delivery_radius_km: deliveryRadius,
        dietary_vegetarian: dietVegetarian,
        dietary_gluten_free: dietGlutenFree,
        dietary_halal: dietHalal,
        dietary_bio: dietBio,
        service_config: serviceConfig,
        photos,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header : titre + bouton preview ── */}
      <div className="flex items-center justify-between gap-4 mb-0">
        <h1
          className="font-display font-bold text-4xl text-black"
          style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
        >
          Fiche traiteur
        </h1>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold border border-[#1A3A52] text-[#1A3A52] hover:bg-[#F5F1E8] transition-colors shrink-0"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          <Eye size={16} />
          Prévisualiser ma fiche
        </button>
      </div>

      {/* Infos générales + Zone d'intervention */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* Gauche : logo + identité */}
        <Card title="Infos générales" className="flex-1">
          <div className="flex flex-col gap-5">

            <Field label="Logo">
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-[#D1D5DB] flex items-center justify-center bg-[#F9FAFB] overflow-hidden shrink-0 cursor-pointer hover:border-navy transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-[#9CA3AF]" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-sm font-bold text-navy underline text-left"
                    style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                  >
                    {logoUrl ? "Changer le logo" : "Uploader un logo"}
                  </button>
                  <p className="text-xs text-[#9CA3AF]" style={{ fontFamily: "Marianne, system-ui, sans-serif" }}>
                    PNG, JPG — max 2 Mo
                  </p>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl(null)}
                      className="text-xs text-[#DC2626] text-left"
                      style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom de la structure">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ex. ESAT Les Jardins"
                />
              </Field>

              <Field label="Type de structure">
                <select
                  value={esatStatus ? "esat" : "ea"}
                  onChange={(e) => setEsatStatus(e.target.value === "esat")}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="esat">ESAT</option>
                  <option value="ea">EA</option>
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={inputClass}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Décrivez votre structure, vos valeurs, vos spécialités…"
              />
            </Field>

          </div>
        </Card>

        {/* Droite : localisation */}
        <Card title="Zone d'intervention" className="flex-1">
          <div className="flex flex-col gap-5">

            <Field label="Rayon de livraison (km)">
              <input
                type="number"
                min={0}
                value={deliveryRadius ?? ""}
                onChange={(e) =>
                  setDeliveryRadius(e.target.value ? Number(e.target.value) : null)
                }
                className={inputClass}
                style={inputStyle}
                placeholder="Ex. 30"
              />
            </Field>

            <Field label="Adresse">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Ex. 12 rue des Acacias"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Ville">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ex. Paris"
                />
              </Field>
              <Field label="Code postal">
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ex. 75001"
                  maxLength={5}
                />
              </Field>
            </div>

          </div>
        </Card>

      </div>

      {/* Galerie photos */}
      <Card title="Galerie photos">
        <p
          className="text-xs text-[#6B7280] -mt-2"
          style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
        >
          Les 3 premières photos apparaissent directement sur votre fiche publique.
        </p>
        <div className="flex flex-wrap gap-3">
          {photos.map((url, i) => (
            <div
              key={url + i}
              className="relative group cursor-grab active:cursor-grabbing"
              style={{
                width: 125,
                height: 125,
                outline: dragOverIndex === i && dragIndex.current !== i
                  ? "2px solid #1A3A52"
                  : i === 0
                  ? "2px solid #FBBF24"
                  : "none",
                borderRadius: 8,
              }}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              {/* Badge étoile sur les 3 premières */}
              {i < 3 && (
                <div className="absolute group/badge" style={{ top: 6, left: 6 }}>
                  <div
                    className="flex items-center gap-1 h-6 rounded px-1.5"
                    style={{ backgroundColor: "#FBBF24" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    {i === 0 && (
                      <span
                        className="text-white leading-none"
                        style={{ fontFamily: "Marianne, system-ui, sans-serif", fontSize: 9, fontWeight: 700 }}
                      >
                        Principale
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute top-8 left-0 z-10 w-44 px-2.5 py-2 rounded-lg shadow-lg pointer-events-none opacity-0 group-hover/badge:opacity-100 transition-opacity"
                    style={{ backgroundColor: "#1A3A52" }}
                  >
                    <p className="text-white leading-snug" style={{ fontFamily: "Marianne, system-ui, sans-serif", fontSize: 11 }}>
                      Cette photo est visible au premier coup d&apos;œil sur votre fiche traiteur.
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <Trash2 size={12} className="text-[#DC2626]" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => photosInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#D1D5DB] hover:border-navy transition-colors text-[#9CA3AF] hover:text-navy disabled:opacity-50"
            style={{ width: 125, height: 125 }}
          >
            <Plus size={20} />
            <span
              className="text-xs font-bold"
              style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
            >
              Ajouter
            </span>
          </button>
        </div>
        <input
          ref={photosInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotosChange}
        />
      </Card>

      {/* Autres infos */}
        <Card title="Autres infos">

            {/* Régimes alimentaires */}
            <div className="flex flex-col gap-3">
              <p
                className="text-xs font-bold text-black"
                style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
              >
                Régimes alimentaires
              </p>

              {(
                [
                  { label: "Végétarien", value: dietVegetarian, set: setDietVegetarian },
                  { label: "Sans gluten", value: dietGlutenFree, set: setDietGlutenFree },
                  { label: "Halal",       value: dietHalal,      set: setDietHalal },
                  { label: "Bio",         value: dietBio,        set: setDietBio },
                ] as const
              ).map(({ label, value, set }) => (
                <div key={label} className="flex items-center justify-between">
                  <span
                    className="text-sm text-black"
                    style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
                  >
                    {label}
                  </span>
                  <Toggle checked={value} onChange={set} />
                </div>
              ))}
            </div>

      </Card>

      {/* ── Types de prestation ── */}
      <Card title="Types de prestation">
        <div className="flex flex-col gap-3">
          {SERVICE_TYPES.map(({ key, label }) => (
            <ServiceTypeRow
              key={key}
              label={label}
              config={serviceConfig[key] ?? { enabled: false }}
              onChange={(c) =>
                setServiceConfig((prev) => ({ ...prev, [key]: c }))
              }
            />
          ))}
        </div>
      </Card>

      {/* ── Barre d'actions ── */}
      <div className="flex items-center justify-between gap-4">
        {error && (
          <p
            className="text-sm text-[#DC2626]"
            style={{ fontFamily: "Marianne, system-ui, sans-serif" }}
          >
            {error}
          </p>
        )}
        {!error && <div />}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || uploading}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white transition-colors disabled:opacity-60"
            style={{
              backgroundColor: saved ? "#16A34A" : "#1A3A52",
              fontFamily: "Marianne, system-ui, sans-serif",
              minWidth: 160,
            }}
          >
            {saved ? (
              <>
                <Check size={16} />
                Enregistré
              </>
            ) : isPending ? (
              "Enregistrement…"
            ) : (
              "Enregistrer les modifications"
            )}
          </button>
        </div>
      </div>

      {/* ── Preview modal ── */}
      {showPreview && (
        <CatererProfilePreviewModal
          data={{
            name,
            esatStatus,
            address,
            city,
            zipCode,
            description,
            logoUrl,
            deliveryRadius,
            serviceConfig,
            photos,
            dietVegetarian,
            dietGlutenFree,
            dietHalal,
            dietBio,
          }}
          onClose={() => setShowPreview(false)}
        />
      )}

    </div>
  );
}
