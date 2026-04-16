-- Champs détaillés pour le wizard de demande de devis en 7 étapes

-- Service type en texte (correspond aux clés service_config du traiteur)
alter table quote_requests
  add column if not exists service_type            text,
  add column if not exists service_type_secondary  text;

-- Rendre meal_type nullable (le service_type text prend le relais)
alter table quote_requests
  alter column meal_type drop not null;

-- Comptages régimes alimentaires
alter table quote_requests
  add column if not exists dietary_bio                boolean not null default false,
  add column if not exists dietary_vegetarian_count   integer,
  add column if not exists dietary_halal_count        integer,
  add column if not exists dietary_gluten_free_count  integer;

-- Boissons détaillées
alter table quote_requests
  add column if not exists drinks_water_still       boolean not null default false,
  add column if not exists drinks_water_sparkling   boolean not null default false,
  add column if not exists drinks_soft              boolean not null default false,
  add column if not exists drinks_soft_details      text,
  add column if not exists drinks_alcohol           boolean not null default false,
  add column if not exists drinks_alcohol_details   text,
  add column if not exists drinks_hot               boolean not null default false;

-- Services additionnels détaillés
alter table quote_requests
  add column if not exists service_equipment_verres  boolean not null default false,
  add column if not exists service_equipment_nappes  boolean not null default false,
  add column if not exists service_equipment_tables  boolean not null default false,
  add column if not exists service_equipment_other   text,
  add column if not exists service_setup             boolean not null default false,
  add column if not exists service_setup_time        time,
  add column if not exists service_setup_other       text;

-- Message au traiteur + mode
alter table quote_requests
  add column if not exists message_to_caterer  text,
  add column if not exists is_compare_mode     boolean not null default false;
