-- ============================================================
-- Migration 032 : split de l'adresse événement en 3 champs
-- ============================================================
-- `event_address` reste la rue / numéro + complément (saisi via un
-- autocomplete BAN côté front), et on ajoute `event_zip_code` +
-- `event_city` pour avoir la donnée structurée (utile pour
-- l'affichage, les recherches par ville, et le matching géographique).
--
-- Les colonnes sont nullable pour ne pas casser les demandes
-- existantes (l'adresse intégrale est conservée dans `event_address`).
-- Les nouvelles demandes auront les 3 champs renseignés par l'UI.

alter table quote_requests
  add column if not exists event_zip_code text,
  add column if not exists event_city     text;

comment on column quote_requests.event_zip_code is
  'Code postal de l''événement. Saisi automatiquement via autocomplete BAN à partir de la migration 032. NULL sur les demandes antérieures (info dans event_address).';

comment on column quote_requests.event_city is
  'Ville de l''événement. Saisi automatiquement via autocomplete BAN à partir de la migration 032. NULL sur les demandes antérieures.';

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
