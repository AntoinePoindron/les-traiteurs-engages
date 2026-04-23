"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle, Clock, ChefHat, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signupAction } from "./actions";
import type { SignupResult, UserType } from "./types";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Email pré-rempli via le lien d'invitation copié par un admin
  // (ex. /signup?email=jean.dupont%40acme.fr)
  const invitedEmail = searchParams.get("email") ?? "";

  const [userType, setUserType] = useState<UserType>("client");
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [email,       setEmail]       = useState(invitedEmail);
  const [password,    setPassword]    = useState("");
  const [siret,       setSiret]       = useState("");
  const [companyName, setCompanyName] = useState("");
  const [catererName, setCatererName] = useState("");
  // 4 types supportés : ESAT / EA (handicap), EI / ACI (insertion).
  // Valeurs en minuscules côté form, converties vers l'enum uppercase
  // (ESAT / EA / EI / ACI) dans l'action serveur.
  const [structureType, setStructureType] = useState<"esat" | "ea" | "ei" | "aci">("esat");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<SignupResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("user_type",     userType);
    fd.set("first_name",    firstName);
    fd.set("last_name",     lastName);
    fd.set("email",         email);
    fd.set("password",      password);
    fd.set("siret",         siret);
    fd.set("company_name",  companyName);
    fd.set("caterer_name",  catererName);
    fd.set("structure_type", structureType);

    const res = await signupAction(fd);

    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setResult(res);

    // Auto-login dans les cas où le compte est actif (client_admin
    // d'une nouvelle structure, traiteur qui peut se connecter pour
    // remplir sa fiche). Les users "pending" restent sur l'écran
    // d'attente.
    const shouldAutoLogin =
      res.status === "active" || res.status === "caterer_pending_validation";

    if (shouldAutoLogin) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) {
        setLoading(false);
        return;
      }
      // Traiteur : on envoie directement sur la fiche traiteur pour
       // qu'il la complète (logo, description, prestations...). Client
       // admin : dashboard.
      const dashboard = res.status === "caterer_pending_validation"
        ? "/caterer/profile"
        : "/client/dashboard";
      router.push(dashboard);
      router.refresh();
      return;
    }

    setLoading(false);
  }

  // ── Écran de succès "pending" (client_user en attente d'admin) ──
  if (result?.ok && result.status === "pending") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-traiteurs-engages.svg" alt="Logo Les Traiteurs Engagés" />
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col items-center text-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#FEF3C7" }}
            >
              <Clock size={26} style={{ color: "#B45309" }} />
            </div>
            <h1 className="font-display text-2xl font-semibold text-dark">
              Demande envoyée
            </h1>
            <p className="text-sm text-gray-medium">
              Votre demande d&apos;adhésion à <strong>{result.companyName}</strong> a bien été
              envoyée. L&apos;administrateur de votre structure doit valider votre accès avant
              que vous puissiez vous connecter.
            </p>
            <p className="text-xs text-gray-medium">
              Vous recevrez un email dès que votre adhésion sera validée.
            </p>
            <Link
              href="/login"
              className="mt-2 text-sm font-bold text-terracotta hover:underline"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulaire d'inscription ──────────────────────────────
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-traiteurs-engages.svg" alt="Logo Les Traiteurs Engagés" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h1 className="font-display text-2xl font-semibold text-dark mb-1">
            Créer un compte
          </h1>
          <p className="text-sm text-gray-medium mb-6">
            {invitedEmail
              ? "Vous avez été invité par un administrateur. Renseignez vos informations pour rejoindre votre structure."
              : "Choisissez votre profil pour commencer."}
          </p>

          {/* Toggle Client / Traiteur — masqué si invité */}
          {!invitedEmail && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setUserType("client")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  userType === "client"
                    ? "bg-white text-dark shadow-sm"
                    : "text-gray-medium hover:text-dark"
                }`}
              >
                <Building2 size={14} />
                Je suis un client
              </button>
              <button
                type="button"
                onClick={() => setUserType("caterer")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  userType === "caterer"
                    ? "bg-white text-dark shadow-sm"
                    : "text-gray-medium hover:text-dark"
                }`}
              >
                <ChefHat size={14} />
                Je suis un traiteur
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-dark mb-1.5">
                  Prénom
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-dark mb-1.5">
                  Nom
                </label>
                <input
                  id="last_name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark mb-1.5">
                Email professionnel
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.fr"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-medium hover:text-dark transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* ── Bloc CLIENT ── (caché si invité ou traiteur) */}
            {!invitedEmail && userType === "client" && (
              <>
                <div className="pt-2 border-t border-gray-100" />

                <div>
                  <label htmlFor="siret" className="block text-sm font-medium text-dark mb-1.5">
                    SIRET de votre structure
                  </label>
                  <input
                    id="siret"
                    type="text"
                    inputMode="numeric"
                    required
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    placeholder="14 chiffres"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  />
                  <p className="mt-1.5 text-xs text-gray-medium">
                    Si votre structure existe déjà, votre adhésion sera soumise à validation.
                    Sinon, vous serez automatiquement administrateur.
                  </p>
                </div>

                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-dark mb-1.5">
                    Nom de la structure <span className="text-gray-medium font-normal">(si nouvelle)</span>
                  </label>
                  <input
                    id="company_name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex. : Acme SAS"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  />
                </div>
              </>
            )}

            {/* ── Bloc TRAITEUR ── */}
            {!invitedEmail && userType === "caterer" && (
              <>
                <div className="pt-2 border-t border-gray-100" />

                <div>
                  <label htmlFor="caterer_siret" className="block text-sm font-medium text-dark mb-1.5">
                    SIRET de votre structure
                  </label>
                  <input
                    id="caterer_siret"
                    type="text"
                    inputMode="numeric"
                    required
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                    placeholder="14 chiffres"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="caterer_name" className="block text-sm font-medium text-dark mb-1.5">
                    Nom de la structure
                  </label>
                  <input
                    id="caterer_name"
                    type="text"
                    required
                    value={catererName}
                    onChange={(e) => setCatererName(e.target.value)}
                    placeholder="Ex. : ESAT Les Jardins"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-dark text-sm placeholder:text-gray-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">
                    Type de structure
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "esat", label: "ESAT",  sub: "Handicap" },
                      { value: "ea",   label: "EA",    sub: "Handicap" },
                      { value: "ei",   label: "EI",    sub: "Insertion" },
                      { value: "aci",  label: "ACI",   sub: "Insertion" },
                    ] as const).map((t) => {
                      const active = structureType === t.value;
                      return (
                        <label
                          key={t.value}
                          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                            active
                              ? "border-terracotta bg-terracotta/5 text-dark"
                              : "border-gray-200 text-gray-medium hover:border-gray-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="structure_type"
                            value={t.value}
                            checked={active}
                            onChange={() => setStructureType(t.value)}
                            className="sr-only"
                          />
                          <span>{t.label}</span>
                          <span className="text-[10px] font-normal text-gray-medium">{t.sub}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Erreur */}
            {error && (
              <p className="text-sm text-coral-red bg-light-pink px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-terracotta text-white rounded-xl font-medium hover:bg-dark-terracotta transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Créer mon compte
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-medium mt-6">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="text-terracotta hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
