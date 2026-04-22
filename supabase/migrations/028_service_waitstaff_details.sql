-- ================================================================
-- Migration 028 : détails du besoin en personnel
-- ================================================================
-- Le wizard de création de demande demande au client de préciser son
-- besoin en personnel (serveurs, barman, accueil…) quand il coche
-- "Personnel" à l'étape 5. Le booléen `service_waitstaff` seul ne
-- suffisait pas pour le traiteur — d'où cette colonne texte libre.
-- ================================================================

alter table quote_requests
  add column if not exists service_waitstaff_details text;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
