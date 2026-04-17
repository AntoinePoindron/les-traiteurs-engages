-- ================================================================
-- Migration 020 : finalisation du flow "comparer 3 devis"
-- ================================================================
-- 1. Ajoute le statut `closed` sur quote_request_caterers (qrc)
--    → verrouille les traiteurs n'ayant pas répondu à temps quand
--    3 devis sont déjà arrivés côté client.
-- 2. Ajoute les coordonnées lat/lng sur caterers + quote_requests
--    pour permettre un matching par rayon de livraison.
-- 3. Fonction SQL `haversine_km` pour calculer la distance en km.
-- 4. Trigger AFTER : dès qu'un 3ème qrc passe en transmitted_to_client,
--    tous les autres qrc `selected` du même request passent à `closed`.
-- ================================================================

-- ── 1. Nouvelle valeur d'enum ──────────────────────────────────

alter type quote_request_caterer_status add value if not exists 'closed';

-- ── 2. Colonnes géo ────────────────────────────────────────────

alter table caterers
  add column if not exists latitude  numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table quote_requests
  add column if not exists event_latitude  numeric(9, 6),
  add column if not exists event_longitude numeric(9, 6);

-- ── 3. Distance haversine (km) ─────────────────────────────────

create or replace function haversine_km(
  lat1 numeric, lng1 numeric,
  lat2 numeric, lng2 numeric
) returns numeric as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$ language sql immutable;

-- ── 4. Lock-out des traiteurs retardataires ────────────────────
-- Quand un qrc passe en transmitted_to_client ET qu'il y a déjà 3
-- qrc transmitted_to_client sur cette demande, tous les qrc encore
-- 'selected' passent à 'closed'.

create or replace function lock_out_remaining_caterers()
returns trigger as $lock$
declare
  v_transmitted_count integer;
begin
  if NEW.status = 'transmitted_to_client' then
    select count(*) into v_transmitted_count
    from quote_request_caterers
    where quote_request_id = NEW.quote_request_id
      and status = 'transmitted_to_client';

    if v_transmitted_count >= 3 then
      update quote_request_caterers
         set status = 'closed'
       where quote_request_id = NEW.quote_request_id
         and status = 'selected';
    end if;
  end if;
  return NEW;
end;
$lock$ language plpgsql;

drop trigger if exists qrc_lock_out_trigger on quote_request_caterers;
create trigger qrc_lock_out_trigger
  after update on quote_request_caterers
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function lock_out_remaining_caterers();

-- Force PostgREST à recharger son schema cache
notify pgrst, 'reload schema';
