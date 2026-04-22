-- ================================================================
-- Migration 029 : élargissement des types de structure
-- ================================================================
-- Ouverture du catalogue aux structures de l'insertion par l'activité
-- économique (SIAE) en plus des structures du handicap (STPA).
--
-- Types existants :
--   - ESAT : Établissement et Service d'Aide par le Travail  (STPA)
--   - EA   : Entreprise Adaptée                              (STPA)
--
-- Nouveaux types :
--   - EI   : Entreprise d'Insertion                (SIAE)
--   - ACI  : Atelier et Chantier d'Insertion       (SIAE)
--
-- Les filtres côté catalogue regroupent désormais ces 4 types en 2
-- catégories de lisibilité pour le client :
--   - Handicap (STPA) : ESAT + EA
--   - Insertion professionnelle (SIAE) : EI + ACI
-- ================================================================

alter type caterer_structure_type add value if not exists 'EI';
alter type caterer_structure_type add value if not exists 'ACI';

-- Note : Postgres exige que ALTER TYPE ADD VALUE soit commité avant
-- d'utiliser les nouvelles valeurs dans la même transaction. Supabase
-- SQL Editor exécute chaque statement en auto-commit, donc aucun
-- problème ici. En cas de besoin de commit manuel : couper le script
-- en 2 et exécuter la seconde moitié séparément.

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
