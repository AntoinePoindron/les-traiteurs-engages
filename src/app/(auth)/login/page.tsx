"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { UserRole, MembershipStatus } from "@/types/database";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // Récupère le rôle pour rediriger vers le bon dashboard
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await supabase
        .from("users")
        .select("role, membership_status")
        .eq("id", user.id)
        .single();

      const profile = profileData as {
        role: UserRole;
        membership_status: MembershipStatus | null;
      } | null;

      // Bloquer l'accès si l'adhésion n'est pas validée
      if (profile?.membership_status === "pending") {
        await supabase.auth.signOut();
        setError(
          "Votre adhésion est en attente de validation par l'administrateur de votre structure."
        );
        setLoading(false);
        return;
      }
      if (profile?.membership_status === "rejected") {
        await supabase.auth.signOut();
        setError(
          "Votre demande d'adhésion a été refusée. Contactez l'administrateur de votre structure."
        );
        setLoading(false);
        return;
      }

      router.push(getDashboardPath(profile?.role));
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img 
              src="/images/logo-traiteurs-engages.svg" 
              alt="Logo Les Traiteurs Engagés" 
            />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h1 className="font-display text-2xl font-semibold text-dark mb-1">
            Connexion
          </h1>
          <p className="text-sm text-gray-medium mb-6">
            Accédez à votre espace personnel
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-dark mb-1.5"
              >
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

            {/* Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-dark mb-1.5"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              {loading && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-medium mt-6">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-terracotta hover:underline font-medium">
            Créer un compte
          </Link>
        </p>

        <p className="text-center text-xs text-gray-medium mt-3">
          Problème de connexion ? Contactez{" "}
          <a
            href="mailto:support@lestraiteursenggages.fr"
            className="text-terracotta hover:underline"
          >
            le support
          </a>
        </p>
      </div>
    </div>
  );
}

function getDashboardPath(role?: UserRole): string {
  switch (role) {
    case "caterer":
      return "/caterer/dashboard";
    case "client_admin":
    case "client_user":
      return "/client/dashboard";
    case "super_admin":
      return "/admin/dashboard";
    default:
      return "/client/dashboard";
  }
}
