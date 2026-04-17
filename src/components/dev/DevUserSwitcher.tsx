"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Loader2, KeyRound, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listDevUsers, type DevUser } from "./actions";
import type { UserRole } from "@/types/database";

const mFont = { fontFamily: "Marianne, system-ui, sans-serif" };
const PASSWORD_KEY = "dev-switcher-password";

const ROLE_LABELS: Record<UserRole, string> = {
  client_admin: "Client admin",
  client_user:  "Client user",
  caterer:      "Traiteur",
  super_admin:  "Super admin",
};

const ROLE_COLORS: Record<UserRole, { bg: string; fg: string }> = {
  client_admin: { bg: "#E0F2FE", fg: "#075985" },
  client_user:  { bg: "#F0F4F8", fg: "#1A3A52" },
  caterer:      { bg: "#FEF3C7", fg: "#92400E" },
  super_admin:  { bg: "#FCE7F3", fg: "#9F1239" },
};

function dashboardPath(role: UserRole): string {
  switch (role) {
    case "caterer":      return "/caterer/dashboard";
    case "client_admin":
    case "client_user":  return "/client/dashboard";
    case "super_admin":  return "/admin/dashboard";
  }
}

interface DevUserSwitcherProps {
  currentUserId: string | null;
}

export default function DevUserSwitcher({ currentUserId }: DevUserSwitcherProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [password, setPassword] = useState<string>("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PASSWORD_KEY) : "";
    if (saved) setPassword(saved);
  }, []);

  useEffect(() => {
    if (!open || users !== null) return;
    listDevUsers().then(setUsers);
  }, [open, users]);

  function savePassword(pw: string) {
    setPassword(pw);
    if (pw) localStorage.setItem(PASSWORD_KEY, pw);
    else    localStorage.removeItem(PASSWORD_KEY);
  }

  async function switchTo(user: DevUser) {
    if (!password) {
      setError("Saisis le mot de passe dev partagé.");
      return;
    }
    setError(null);
    setSwitchingId(user.id);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (signInError) {
      setSwitchingId(null);
      setError(`Login ${user.email} échoué : ${signInError.message}`);
      return;
    }

    router.push(dashboardPath(user.role));
    router.refresh();
    setOpen(false);
    setSwitchingId(null);
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[60] w-11 h-11 rounded-full bg-[#1A3A52] text-white shadow-lg hover:bg-[#0F2A3F] transition-colors flex items-center justify-center"
        aria-label="Dev — Switch user"
        title="Dev — Switch user"
      >
        <Users size={18} />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-16 right-4 z-[60] w-[320px] bg-white rounded-xl shadow-2xl border border-[#E5E7EB] flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100vh - 96px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6] shrink-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#FEF3C7", color: "#92400E", ...mFont }}
              >
                DEV
              </span>
              <span className="text-sm font-bold text-black" style={mFont}>
                Switch user
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[#9CA3AF] hover:text-black"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Password */}
          <div className="px-4 py-3 border-b border-[#F3F4F6] shrink-0">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] mb-1.5" style={mFont}>
              <KeyRound size={11} />
              Mot de passe dev partagé
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => savePassword(e.target.value)}
              placeholder="Saisi une fois, gardé en localStorage"
              className="w-full border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-sm text-black outline-none focus:border-[#1A3A52] transition-colors"
              style={mFont}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-[#FEF2F2] border-b border-[#FEE2E2] shrink-0">
              <p className="text-xs text-[#DC2626]" style={mFont}>{error}</p>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {users === null && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-[#9CA3AF]" />
              </div>
            )}
            {users && users.length === 0 && (
              <p className="px-4 py-6 text-xs text-center text-[#9CA3AF]" style={mFont}>
                Aucun utilisateur trouvé.
              </p>
            )}
            {users && users.map((u) => {
              const isCurrent = u.id === currentUserId;
              const isSwitching = switchingId === u.id;
              const colors = ROLE_COLORS[u.role];
              const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => switchTo(u)}
                  disabled={isCurrent || isSwitching || !u.is_active}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-[#F3F4F6] last:border-0 text-left transition-colors ${
                    isCurrent
                      ? "bg-[#F0F4F8] cursor-default"
                      : u.is_active
                        ? "hover:bg-[#F5F1E8] cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-black truncate" style={mFont}>
                        {displayName}
                      </span>
                      {isCurrent && <Check size={12} className="shrink-0 text-[#059669]" />}
                    </div>
                    <span className="text-[11px] text-[#6B7280] truncate" style={mFont}>
                      {u.entity_name ?? u.email}
                    </span>
                  </div>
                  <span
                    className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.fg, ...mFont }}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                  {isSwitching && <Loader2 size={12} className="animate-spin text-[#1A3A52] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
