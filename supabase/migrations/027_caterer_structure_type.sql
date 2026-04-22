-- ================================================================
-- Migration 027 : type de structure traiteur (ESAT / EA / …)
-- ================================================================
-- Jusqu'ici, le type était encodé sur `caterers.esat_status` (bool :
-- true = ESAT, false = EA). C'est limitant : on veut ajouter d'autres
-- types inclusifs à terme (TIH = Travailleur Indépendant Handicapé,
-- EATT, IAE, etc.).
--
-- On introduit une colonne `structure_type` basée sur un enum
-- PostgreSQL (extensible via `alter type ... add value`). On conserve
-- `esat_status` pour la rétrocompatibilité et les calculs AGEFIPH
-- existants — les deux champs sont synchronisés au backfill.
-- ================================================================

-- ── 1. Type enum ──────────────────────────────────────────────────
-- Idempotent : PG n'a pas `create type if not exists`, on utilise un
-- DO block qui swallow l'erreur si le type existe déjà.
do $$ begin
  create type caterer_structure_type as enum ('ESAT', 'EA');
exception when duplicate_object then null;
end $$;

-- ── 2. Colonne + backfill ────────────────────────────────────────
alter table caterers
  add column if not exists structure_type caterer_structure_type;

update caterers
set structure_type = case
  when esat_status = true then 'ESAT'::caterer_structure_type
  else 'EA'::caterer_structure_type
end
where structure_type is null;

alter table caterers
  alter column structure_type set not null;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

-- ── Pour ajouter un nouveau type plus tard, exemple : ────────────
-- alter type caterer_structure_type add value 'TIH';
-- (pas besoin de modifier cette migration)
