-- Migration 016 : logo de la structure cliente
-- ============================================================
-- Ajoute logo_url sur companies. L'upload se fait depuis le
-- navigateur vers le bucket Supabase Storage "company-assets"
-- (à créer manuellement dans Supabase Studio / dashboard).
--
-- RLS bucket attendue (à configurer dans le dashboard) :
--   - lecture publique (les logos sont affichés côté front)
--   - écriture réservée aux client_admin sur leur company_id
--     (path prefix `${company_id}/...`)

alter table companies
  add column if not exists logo_url text;
