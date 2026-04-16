import { createClient } from "@/lib/supabase/server";
import { updateProfileAction } from "./actions";
import type { UserRole } from "@/types/database";
import { User, Building2, Mail, Shield } from "lucide-react";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

const ROLE_LABELS: Record<UserRole, string> = {
  client_admin: "Administrateur",
  client_user:  "Collaborateur",
  caterer:      "Traiteur",
  super_admin:  "Super admin",
};

export default async function ClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("users")
    .select("first_name, last_name, role, companies ( name, city )")
    .eq("id", user!.id)
    .single();

  const profile = profileData as {
    first_name: string | null;
    last_name:  string | null;
    role:       UserRole;
    companies:  { name: string; city: string | null } | null;
  } | null;

  const canEdit = profile?.role === "client_admin" || profile?.role === "client_user";
  const initials = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .map((s) => s![0].toUpperCase())
    .join("") || user!.email![0].toUpperCase();

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "680px" }}>

          <h1
            className="font-display font-bold text-4xl text-black"
            style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
          >
            Mon profil
          </h1>

          {/* Avatar + identité */}
          <div className="bg-white rounded-lg p-6 flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-bold"
              style={{ backgroundColor: "#1A3A52", ...mFont }}
            >
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-display font-bold text-2xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "—"}
              </p>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded w-fit"
                style={{ backgroundColor: "#F0F4F7", color: "#1A3A52", ...mFont }}
              >
                <Shield size={11} />
                {profile ? ROLE_LABELS[profile.role] : "—"}
              </span>
            </div>
          </div>

          {/* Infos lecture seule */}
          <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
            <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
              Informations
            </p>

            <InfoRow icon={Mail} label="Adresse e-mail" value={user!.email ?? "—"} />

            {profile?.companies && (
              <InfoRow
                icon={Building2}
                label="Entreprise"
                value={[profile.companies.name, profile.companies.city].filter(Boolean).join(", ")}
              />
            )}
          </div>

          {/* Formulaire d'édition */}
          {canEdit && (
            <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
              <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                Modifier mes informations
              </p>

              <form action={updateProfileAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-black" style={mFont}>
                      Prénom
                    </label>
                    <input
                      name="first_name"
                      type="text"
                      defaultValue={profile?.first_name ?? ""}
                      placeholder="Votre prénom"
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                      style={mFont}
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-black" style={mFont}>
                      Nom
                    </label>
                    <input
                      name="last_name"
                      type="text"
                      defaultValue={profile?.last_name ?? ""}
                      placeholder="Votre nom"
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                      style={mFont}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "#1A3A52", ...mFont }}
                  >
                    <User size={14} />
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: "#F5F1E8" }}
      >
        <Icon size={15} style={{ color: "#1A3A52" }} />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] text-[#9CA3AF]" style={mFont}>{label}</p>
        <p className="text-sm font-bold text-black" style={mFont}>{value}</p>
      </div>
    </div>
  );
}
