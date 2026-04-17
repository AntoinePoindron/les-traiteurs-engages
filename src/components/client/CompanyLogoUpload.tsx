"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const MAX_BYTES = 2 * 1024 * 1024;

interface CompanyLogoUploadProps {
  companyId: string;
  initialLogoUrl: string | null;
}

export default function CompanyLogoUpload({ companyId, initialLogoUrl }: CompanyLogoUploadProps) {
  const supabase = useRef(createClient());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Le fichier dépasse 2 Mo.");
      return;
    }

    setUploading(true);
    const path = `${companyId}/logo/${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabase.current.storage
      .from("company-assets")
      .upload(path, file, { upsert: true });

    if (uploadError || !data) {
      setError("Échec de l'upload. Réessayez.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.current.storage
      .from("company-assets")
      .getPublicUrl(data.path);

    setLogoUrl(urlData.publicUrl);
    setUploading(false);
  }

  function handleRemove() {
    setLogoUrl(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-[#D1D5DB] flex items-center justify-center bg-[#F9FAFB] overflow-hidden shrink-0 cursor-pointer hover:border-[#1A3A52] transition-colors"
          aria-label={logoUrl ? "Changer le logo" : "Uploader un logo"}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Upload size={20} className="text-[#9CA3AF]" />
          )}
        </button>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm font-bold text-[#1A3A52] underline text-left disabled:opacity-50"
            style={mFont}
          >
            {uploading ? "Upload en cours…" : logoUrl ? "Changer le logo" : "Uploader un logo"}
          </button>
          <p className="text-xs text-[#9CA3AF]" style={mFont}>
            PNG, JPG — max 2 Mo
          </p>
          {logoUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-[#DC2626] text-left"
              style={mFont}
            >
              Supprimer
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="text-xs text-[#DC2626]" style={mFont}>
          {error}
        </p>
      )}
    </div>
  );
}
