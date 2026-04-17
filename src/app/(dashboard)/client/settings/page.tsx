import { createClient } from "@/lib/supabase/server";
import { Building2, MapPin, Hash, Euro, Save, Shield } from "lucide-react";
import { updateCompanyAction } from "./actions";
import CompanyLogoUpload from "@/components/client/CompanyLogoUpload";
import type { UserRole } from "@/types/database";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };

export default async function ClientSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Profil + company_id
  const { data: profileData } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user!.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    company_id: string | null;
  } | null;

  const isAdmin = profile?.role === "client_admin";

  // Récupérer la company
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let company: any = null;
  if (profile?.company_id) {
    const { data: companyData } = await supabase
      .from("companies")
      .select("id, name, siret, address, city, zip_code, oeth_eligible, budget_annual, logo_url")
      .eq("id", profile.company_id)
      .single();
    company = companyData;
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F5F1E8", minHeight: "100vh" }}>
      <div className="pt-[54px] px-6 pb-12">
        <div className="mx-auto flex flex-col gap-6" style={{ maxWidth: "680px" }}>

          {/* Titre */}
          <div className="flex flex-col gap-1">
            <h1
              className="font-display font-bold text-4xl text-black"
              style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}
            >
              Paramètres structure
            </h1>
            <p className="text-sm text-[#6B7280]" style={mFont}>
              Informations de votre entreprise et préférences administratives.
            </p>
          </div>

          {/* Pas de structure rattachée */}
          {!company && (
            <div className="bg-white rounded-lg p-6 flex flex-col gap-2">
              <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                Aucune structure rattachée
              </p>
              <p className="text-sm text-[#6B7280]" style={mFont}>
                Votre compte n&apos;est lié à aucune entreprise. Contactez le support.
              </p>
            </div>
          )}

          {/* Lecture seule pour non-admin */}
          {company && !isAdmin && (
            <>
              <div
                className="bg-white rounded-lg p-4 flex items-start gap-3 border-l-4"
                style={{ borderLeftColor: "#1A3A52" }}
              >
                <Shield size={16} className="shrink-0 mt-0.5" style={{ color: "#1A3A52" }} />
                <p className="text-xs text-[#6B7280]" style={mFont}>
                  Seul l&apos;administrateur de la structure peut modifier ces informations. Vous pouvez les consulter ci-dessous.
                </p>
              </div>

              <div className="bg-white rounded-lg p-6 flex flex-col gap-4">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Informations
                </p>
                {company.logo_url && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#F5F1E8]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={company.logo_url} alt="Logo de la structure" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] text-[#9CA3AF]" style={mFont}>Logo</p>
                      <p className="text-sm font-bold text-black" style={mFont}>{company.name}</p>
                    </div>
                  </div>
                )}
                <ReadRow icon={Building2} label="Nom" value={company.name ?? "—"} />
                <ReadRow icon={Hash}      label="SIRET" value={company.siret ?? "—"} />
                <ReadRow
                  icon={MapPin}
                  label="Adresse"
                  value={[company.address, company.zip_code, company.city].filter(Boolean).join(", ") || "—"}
                />
                <ReadRow
                  icon={Euro}
                  label="Budget annuel"
                  value={company.budget_annual != null ? `${Number(company.budget_annual).toLocaleString("fr-FR")} €` : "—"}
                />
                <ReadRow
                  icon={Shield}
                  label="Soumis à l&apos;OETH"
                  value={company.oeth_eligible ? "Oui" : "Non"}
                />
              </div>
            </>
          )}

          {/* Formulaire admin */}
          {company && isAdmin && (
            <form action={updateCompanyAction} className="flex flex-col gap-6">

              {/* Identité */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Identité de la structure
                </p>

                <Field label="Logo">
                  <CompanyLogoUpload
                    companyId={company.id}
                    initialLogoUrl={company.logo_url ?? null}
                  />
                </Field>

                <Field label="Nom de la structure" required>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={company.name ?? ""}
                    placeholder="Ex. : Acme SAS"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </Field>

                <Field label="SIRET">
                  <input
                    name="siret"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    defaultValue={company.siret ?? ""}
                    placeholder="14 chiffres"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </Field>
              </div>

              {/* Adresse */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Adresse
                </p>

                <Field label="Adresse postale">
                  <input
                    name="address"
                    type="text"
                    defaultValue={company.address ?? ""}
                    placeholder="N° et nom de rue"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </Field>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="sm:w-[160px]">
                    <Field label="Code postal">
                      <input
                        name="zip_code"
                        type="text"
                        inputMode="numeric"
                        defaultValue={company.zip_code ?? ""}
                        placeholder="75001"
                        className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                        style={mFont}
                      />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Ville">
                      <input
                        name="city"
                        type="text"
                        defaultValue={company.city ?? ""}
                        placeholder="Paris"
                        className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                        style={mFont}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Préférences AGEFIPH / budget */}
              <div className="bg-white rounded-lg p-6 flex flex-col gap-5">
                <p className="font-display font-bold text-xl text-black" style={{ fontVariationSettings: "'SOFT' 0, 'WONK' 1" }}>
                  Budget et obligation d&apos;emploi
                </p>

                <Field label="Budget annuel restauration (€)">
                  <input
                    name="budget_annual"
                    type="text"
                    inputMode="decimal"
                    defaultValue={company.budget_annual != null ? String(company.budget_annual) : ""}
                    placeholder="Ex. : 50000"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
                    style={mFont}
                  />
                </Field>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    name="oeth_eligible"
                    type="checkbox"
                    defaultChecked={!!company.oeth_eligible}
                    className="mt-0.5 w-4 h-4 rounded border-[#E5E7EB] text-[#1A3A52] focus:ring-[#1A3A52] cursor-pointer"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-black" style={mFont}>
                      Structure soumise à l&apos;OETH
                    </span>
                    <span className="text-xs text-[#6B7280]" style={mFont}>
                      Obligation d&apos;Emploi des Travailleurs Handicapés (≥ 20 salariés). Active la valorisation AGEFIPH des commandes ESAT.
                    </span>
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#1A3A52", ...mFont }}
                >
                  <Save size={14} />
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-black" style={mFont}>
        {label}
        {required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReadRow({
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
