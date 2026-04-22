"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SignupResult } from "./types";
import type { CatererStructureType } from "@/types/database";

// ── Inscription traiteur ─────────────────────────────────────────
// Le traiteur crée son compte + sa structure. Le compte est
// immédiatement actif (il peut se connecter et commencer à
// remplir sa fiche), mais `caterers.is_validated = false`.
// Tant qu'il n'est pas validé par un super_admin, il ne sera
// pas visible côté client (les filtres de recherche utilisent
// `is_validated = true`).

async function signupCaterer(
  email:         string,
  password:      string,
  firstName:     string,
  lastName:      string,
  siret:         string,
  catererName:   string,
  structureType: CatererStructureType,
): Promise<SignupResult> {
  // esat_status conservé pour la rétrocompat (calculs AGEFIPH) — seul
  // ESAT donne droit à la valorisation AGEFIPH côté client.
  const esatStatus = structureType === "ESAT";
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findErr } = await (admin as any)
    .from("caterers")
    .select("id, name")
    .eq("siret", siret)
    .maybeSingle();

  if (findErr) {
    console.error("[signupCaterer] find caterer failed:", findErr);
    return { ok: false, error: "Impossible de vérifier la structure. Réessayez." };
  }

  if (existing) {
    return {
      ok: false,
      error: "Ce SIRET correspond déjà à un traiteur enregistré. Connectez-vous.",
    };
  }

  // Création de l'auth user. On ne passe PAS role:'caterer' dans les
  // metadata — le trigger handle_new_user insérerait une ligne users
  // avec role='caterer' et caterer_id=null, ce qui viole la contrainte
  // users_role_company_check. On laisse le trigger créer avec le rôle
  // par défaut (client_user), puis l'upsert ci-dessous ajuste role +
  // caterer_id en un seul shot.
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authErr || !authData?.user) {
    console.error("[signupCaterer] create user failed:", authErr);
    const lower = authErr?.message?.toLowerCase() ?? "";
    const msg = lower.includes("already")
      ? "Un compte existe déjà avec cet email."
      : "Création du compte impossible. Réessayez.";
    return { ok: false, error: msg };
  }

  const userId = authData.user.id;

  // Création de la fiche traiteur (non validée)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: createdCaterer, error: createErr } = await (admin as any)
    .from("caterers")
    .insert({
      name:           catererName,
      siret,
      esat_status:    esatStatus,
      structure_type: structureType,
      is_validated:   false,
    })
    .select("id, name")
    .single();

  if (createErr || !createdCaterer) {
    console.error("[signupCaterer] create caterer failed:", createErr);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Création de la structure impossible. Réessayez." };
  }

  // Profil user (role=caterer, caterer_id lié, active pour l'auth
  // mais `caterers.is_validated=false` tant qu'il n'est pas qualifié)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (admin as any)
    .from("users")
    .upsert(
      {
        id:                userId,
        email,
        first_name:        firstName,
        last_name:         lastName,
        caterer_id:        createdCaterer.id,
        role:              "caterer",
        membership_status: "active",
      },
      { onConflict: "id" }
    );

  if (upsertErr) {
    console.error("[signupCaterer] upsert user failed:", upsertErr);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Configuration du compte impossible : ${upsertErr.message}` };
  }

  // Notification super_admins pour qualification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: superAdmins } = await (admin as any)
    .from("users")
    .select("id")
    .eq("role", "super_admin");

  const fullName = `${firstName} ${lastName}`.trim();
  const notifs = (superAdmins ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sa: any) => ({
      user_id:             sa.id,
      type:                "caterer_pending_qualification",
      title:               "Nouveau traiteur à qualifier",
      body:                `${catererName} (${fullName}) vient de s'inscrire.`,
      related_entity_type: "caterer",
      related_entity_id:   createdCaterer.id,
    })
  );

  if (notifs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: notifErr } = await (admin as any)
      .from("notifications")
      .insert(notifs);
    if (notifErr) console.error("[signupCaterer] notifications failed:", notifErr);
  }

  return {
    ok:          true,
    status:      "caterer_pending_validation",
    catererName: createdCaterer.name,
  };
}

/**
 * Inscription d'un user client.
 *
 * Logique :
 *  - Cherche la structure par SIRET (normalisé sans espaces).
 *  - Si elle existe → user devient `client_user` en `pending`,
 *    notification envoyée aux admins existants.
 *  - Si elle n'existe pas → création de la structure + user devient
 *    `client_admin` actif (premier user = admin).
 *
 * On utilise le service-role pour pouvoir créer la company,
 * mettre à jour le rôle et le status sans contraintes RLS,
 * après avoir validé les inputs côté serveur.
 */
export async function signupAction(formData: FormData): Promise<SignupResult> {
  // ── Lecture & validation des champs ────────────────────────
  const userType  = ((formData.get("user_type") as string | null) ?? "client").trim();
  const email     = ((formData.get("email")     as string | null) ?? "").trim().toLowerCase();
  const password  = (formData.get("password")  as string | null) ?? "";
  const firstName = ((formData.get("first_name") as string | null) ?? "").trim();
  const lastName  = ((formData.get("last_name")  as string | null) ?? "").trim();
  const siretRaw  = ((formData.get("siret")    as string | null) ?? "").trim();
  const companyName = ((formData.get("company_name") as string | null) ?? "").trim();
  const catererName = ((formData.get("caterer_name") as string | null) ?? "").trim();
  // Type de structure : 4 valeurs autorisées (minuscules côté form,
  // uppercase côté enum DB). Fallback sécurisé sur ESAT si l'input
  // arrive vide ou inconnu.
  const rawType = ((formData.get("structure_type") as string | null) ?? "esat").toLowerCase();
  const structureType: CatererStructureType = (() => {
    switch (rawType) {
      case "ea":  return "EA";
      case "ei":  return "EI";
      case "aci": return "ACI";
      case "esat":
      default:
        return "ESAT";
    }
  })();

  if (!email || !password) {
    return { ok: false, error: "Email et mot de passe sont requis." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (!firstName || !lastName) {
    return { ok: false, error: "Prénom et nom sont requis." };
  }

  // ── Routing : traiteur ─────────────────────────────────────
  if (userType === "caterer") {
    const siret = siretRaw.replace(/[\s-]/g, "");
    if (!/^\d{14}$/.test(siret)) {
      return { ok: false, error: "Le SIRET doit contenir 14 chiffres." };
    }
    if (!catererName) {
      return { ok: false, error: "Le nom de la structure est requis." };
    }
    return signupCaterer(email, password, firstName, lastName, siret, catererName, structureType);
  }

  const admin = createAdminClient();

  // ── Cas "invité par un admin" ─────────────────────────────
  // Si l'email correspond à un company_employees invité (invited_at non
  // null, user_id null), on saute la logique SIRET : le trigger SQL
  // handle_new_user rattachera l'utilisateur à la company à la création.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitedEmp } = await (admin as any)
    .from("company_employees")
    .select("id, company_id, companies(name)")
    .eq("email", email)
    .not("invited_at", "is", null)
    .is("user_id", null)
    .maybeSingle();

  if (invitedEmp) {
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (authErr || !authData?.user) {
      console.error("[signupAction] create user (invited) failed:", authErr);
      const lower = authErr?.message?.toLowerCase() ?? "";
      let msg = "Création du compte impossible.";
      if (lower.includes("already")) msg = "Un compte existe déjà avec cet email.";
      else if (lower.includes("password")) msg = "Mot de passe invalide (minimum 8 caractères).";
      else if (authErr?.message) msg = `Création du compte impossible : ${authErr.message}`;
      return { ok: false, error: msg };
    }

    const newUserId = authData.user.id;

    // Le trigger handle_new_user est no-op pour éviter les soucis de RLS.
    // On crée/met à jour la ligne `users` ici via le service-role (bypass RLS).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empRow = invitedEmp as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: linkErr } = await (admin as any)
      .from("users")
      .upsert(
        {
          id:                newUserId,
          email,
          first_name:        firstName,
          last_name:         lastName,
          company_id:        empRow.company_id,
          role:              "client_user",
          membership_status: "active",
        },
        { onConflict: "id" }
      );
    if (linkErr) {
      console.error("[signupAction] upsert user (invited) failed:", linkErr);
      return { ok: false, error: `Création du compte impossible : ${linkErr.message}` };
    }

    // Lier l'effectif au user (badge "En attente" disparaît)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: empLinkErr } = await (admin as any)
      .from("company_employees")
      .update({ user_id: newUserId })
      .eq("id", empRow.id);
    if (empLinkErr) {
      console.error("[signupAction] update employee user_id failed:", empLinkErr);
    }

    const compName = empRow.companies?.name ?? "votre structure";
    return { ok: true, status: "active", companyName: compName };
  }

  // ── Cas standard : SIRET requis ─────────────────────────────
  const siret = siretRaw.replace(/[\s-]/g, "");
  if (!/^\d{14}$/.test(siret)) {
    return { ok: false, error: "Le SIRET doit contenir 14 chiffres." };
  }

  // ── Recherche de la structure par SIRET ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingCompany, error: findErr } = await (admin as any)
    .from("companies")
    .select("id, name")
    .eq("siret", siret)
    .maybeSingle();

  if (findErr) {
    console.error("[signupAction] find company failed:", findErr);
    return { ok: false, error: "Impossible de vérifier la structure. Réessayez." };
  }

  // Si nouvelle structure, le nom est requis
  if (!existingCompany && !companyName) {
    return {
      ok: false,
      error: "Cette structure n'existe pas encore. Renseignez aussi son nom pour la créer.",
    };
  }

  // ── Création de l'auth user ───────────────────────────────
  // email_confirm: true → on bypasse la confirmation par email pour cette V1
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name:  lastName,
    },
  });

  if (authErr || !authData?.user) {
    console.error("[signupAction] create user failed:", authErr);
    const msg = authErr?.message?.toLowerCase().includes("already")
      ? "Un compte existe déjà avec cet email."
      : "Création du compte impossible. Réessayez.";
    return { ok: false, error: msg };
  }

  const userId = authData.user.id;

  // Le trigger handle_new_user a créé une ligne dans `users` avec
  // role = 'client_user', membership_status = 'active' par défaut.
  // On ajuste maintenant selon le scénario.

  let companyId: string;
  let companyDisplayName: string;
  let isFirstUser: boolean;

  if (existingCompany) {
    companyId = existingCompany.id;
    companyDisplayName = existingCompany.name;
    isFirstUser = false;
  } else {
    // Création de la nouvelle structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdCompany, error: createErr } = await (admin as any)
      .from("companies")
      .insert({
        name:  companyName,
        siret: siret,
      })
      .select("id, name")
      .single();

    if (createErr || !createdCompany) {
      console.error("[signupAction] create company failed:", createErr);
      // Nettoyage : supprimer l'auth user créé pour éviter les comptes orphelins
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Création de la structure impossible. Réessayez." };
    }
    companyId = createdCompany.id;
    companyDisplayName = createdCompany.name;
    isFirstUser = true;

    // Créer un service "Direction" par défaut pour cette nouvelle entreprise.
    // Le client_admin y sera rattaché plus bas, et ce service pourra servir
    // de catégorie par défaut pour les demandes/commandes de l'admin.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("company_services")
      .insert({
        company_id:    companyId,
        name:          "Direction",
        annual_budget: 0,
      });
  }

  // ── Mise à jour du profil user ─────────────────────────────
  // Premier user d'une nouvelle structure → client_admin actif
  // User d'une structure existante → client_user en attente de validation
  // Le trigger SQL est no-op : on doit créer la ligne `users` ici via
  // upsert (le service-role bypass la RLS users_insert).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (admin as any)
    .from("users")
    .upsert(
      {
        id:                userId,
        email,
        first_name:        firstName,
        last_name:         lastName,
        company_id:        companyId,
        role:              isFirstUser ? "client_admin" : "client_user",
        membership_status: isFirstUser ? "active" : "pending",
      },
      { onConflict: "id" }
    );

  if (updateErr) {
    console.error("[signupAction] upsert user profile failed:", updateErr);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Configuration du compte impossible : ${updateErr.message}` };
  }

  // ── Admin : rattachement automatique à Effectifs / service Direction ──
  // L'admin apparaît dans la section Effectifs avec un service par défaut
  // "Direction" qu'il peut ensuite modifier s'il le souhaite. Pour les
  // entreprises nouvellement créées, le service Direction vient d'être
  // inséré juste au-dessus. Pour une entreprise existante, il est censé
  // exister grâce à la migration 022 (ou a été créé manuellement).
  if (isFirstUser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: directionService } = await (admin as any)
      .from("company_services")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", "Direction")
      .limit(1)
      .maybeSingle();

    const directionId = (directionService as { id: string } | null)?.id ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("company_employees")
      .insert({
        company_id: companyId,
        service_id: directionId,
        user_id:    userId,
        first_name: firstName,
        last_name:  lastName,
        email,
        position:   "Administrateur",
      });
  }

  // ── Notification aux admins si pending ────────────────────
  if (!isFirstUser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admins } = await (admin as any)
      .from("users")
      .select("id")
      .eq("company_id", companyId)
      .eq("role", "client_admin")
      .eq("membership_status", "active");

    const fullName = `${firstName} ${lastName}`.trim();
    const notifs = (admins ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => ({
        user_id:             a.id,
        type:                "collaborator_pending",
        title:               "Nouvelle demande d'adhésion",
        body:                `${fullName} souhaite rejoindre votre structure.`,
        related_entity_type: "user",
        related_entity_id:   userId,
      })
    );

    if (notifs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: notifErr } = await (admin as any)
        .from("notifications")
        .insert(notifs);
      if (notifErr) {
        console.error("[signupAction] insert notifications failed:", notifErr);
        // non bloquant
      }
    }
  }

  return {
    ok:           true,
    status:       isFirstUser ? "active" : "pending",
    companyName:  companyDisplayName,
  };
}
