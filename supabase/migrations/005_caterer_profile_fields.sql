-- Migration 005 : champs supplémentaires pour la fiche traiteur
-- ============================================================

alter table caterers
  add column if not exists logo_url             text,
  add column if not exists delivery_radius_km   integer,
  add column if not exists dietary_vegetarian   boolean not null default false,
  add column if not exists dietary_gluten_free  boolean not null default false,
  add column if not exists dietary_halal        boolean not null default false,
  add column if not exists dietary_bio          boolean not null default false,
  -- Config par type de prestation : { [meal_type]: { enabled, capacity_min, capacity_max, price_per_person_min, global_min, lead_time_days } }
  add column if not exists service_config       jsonb not null default '{}';
