// Types partagés entre la page client et la server action.
// Ne PAS définir ces types dans actions.ts : un fichier "use server"
// ne doit exporter que des fonctions async (les exports de types
// peuvent empêcher Next.js de générer la route → 404).

export type SignupResult =
  | { ok: true; status: "active"; companyName: string }
  | { ok: true; status: "pending"; companyName: string }
  | { ok: true; status: "caterer_pending_validation"; catererName: string }
  | { ok: false; error: string };

export type UserType = "client" | "caterer";
