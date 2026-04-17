-- ================================================================
-- Migration 017 : statut d'adhésion pour les users client
-- ================================================================
-- Lors de l'inscription d'un user à une structure existante,
-- l'admin de la structure doit valider l'adhésion. On ajoute
-- une colonne membership_status pour tracker ce flow.
--
--   pending  : user inscrit, en attente de validation par l'admin
--   active   : user actif (par défaut pour les users existants)
--   rejected : adhésion refusée par l'admin
-- ================================================================

alter table users
  add column if not exists membership_status text not null default 'active'
  check (membership_status in ('pending', 'active', 'rejected'));

-- Index pour récupérer rapidement les pending d'une company
create index if not exists users_pending_company_idx
  on users(company_id, membership_status)
  where membership_status = 'pending';

-- Force PostgREST à recharger son schema cache
notify pgrst, 'reload schema';
