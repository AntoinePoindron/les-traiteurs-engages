/**
 * Normalise un nom en base alphanum uppercase (accents strippés).
 * Helper interne.
 */
function normalizeName(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // drop diacritics
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/**
 * Génère un préfixe de facturation lisible à partir du nom d'un traiteur.
 *
 * Règles :
 *  - Normalize Unicode (NFD) pour décomposer les diacritiques (é → e + ´)
 *  - Garde uniquement A-Z / 0-9 (les accents et signes sont strippés)
 *  - Uppercase, tronqué à 5 caractères par défaut
 *  - Si le résultat est vide (nom non ASCII ou que des symboles),
 *    on renvoie "C" + 4 premiers chars de l'id en fallback.
 *
 * Utilisation :
 *   generateCatererSlug("1001 Saveurs")       → "1001S"
 *   generateCatererSlug("Les Amis d'Éva")     → "LESAM"
 *   generateCatererSlug("Saveurs d'ailleurs") → "SAVEU"
 *
 * L'unicité cross-caterer n'est PAS garantie par ce helper — utiliser
 * `generateUniqueCatererSlug` qui vérifie via un callback et prolonge
 * le slug en cas de collision.
 */
export function generateCatererSlug(
  name: string,
  fallbackId?: string,
  length = 5,
): string {
  const normalized = normalizeName(name).slice(0, length);

  if (normalized) return normalized;

  if (fallbackId) return `C${fallbackId.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase()}`;
  return "CATER";
}

/**
 * Essaie de générer un slug unique en vérifiant côté DB. Stratégie :
 *   1. 5 chars (lisibilité maximale)
 *   2. 8 chars si collision (distingue "Saveurs d'ailleurs" / "Saveurs inclusives"
 *      → SAVEU vs SAVEURSI)
 *   3. 10 chars si collision persistante
 *   4. Fallback numérique (SAVEU1, SAVEU2, …) si toujours pas unique ou
 *      si le nom est trop court pour étendre plus loin.
 *
 * `isSlugTaken` est passé en callback pour rester côté lib purement —
 * le server action qui appelle branche le check DB réel.
 */
export async function generateUniqueCatererSlug(
  name: string,
  isSlugTaken: (slug: string) => Promise<boolean>,
  fallbackId?: string,
): Promise<string> {
  const normalized = normalizeName(name);

  // Candidats progressifs : 5 → 8 → 10 chars, dédupliqués si le nom
  // est trop court pour aller jusqu'à 8 ou 10.
  const candidates = Array.from(
    new Set(
      [5, 8, 10]
        .map((n) => normalized.slice(0, n))
        .filter((s) => s.length > 0),
    ),
  );

  // Fallback si le nom ne produit rien d'exploitable
  if (candidates.length === 0) {
    const base = fallbackId
      ? `C${fallbackId.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase()}`
      : "CATER";
    if (!(await isSlugTaken(base))) return base;
    // Fallback numérique sur le fallback lui-même
    for (let i = 1; i < 100; i++) {
      const c = `${base}${i}`;
      if (!(await isSlugTaken(c))) return c;
    }
    return `X${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  // Essai progressif sur chaque longueur
  for (const candidate of candidates) {
    if (!(await isSlugTaken(candidate))) return candidate;
  }

  // Fallback numérique à partir du slug 5 chars
  const base5 = candidates[0]!;
  for (let i = 1; i < 100; i++) {
    const c = `${base5}${i}`;
    if (!(await isSlugTaken(c))) return c;
  }

  return `X${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
