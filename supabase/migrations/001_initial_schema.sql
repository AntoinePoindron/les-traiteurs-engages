-- ============================================================
-- LES TRAITEURS ENGAGÉS — Schéma initial
-- Migration 001 : Création de toutes les tables
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- recherche full-text

-- ============================================================
-- TYPES ENUM
-- ============================================================

create type user_role as enum ('client_admin', 'client_user', 'caterer', 'super_admin');

create type quote_request_status as enum (
  'draft',
  'pending_review',
  'approved',
  'sent_to_caterers',
  'completed',
  'cancelled'
);

create type quote_request_caterer_status as enum (
  'selected',
  'responded',
  'transmitted_to_client',
  'rejected'
);

create type quote_status as enum (
  'draft',
  'sent',
  'accepted',
  'refused',
  'expired'
);

create type order_status as enum (
  'confirmed',
  'in_progress',
  'delivered',
  'invoiced',
  'paid',
  'disputed'
);

create type invoice_status as enum (
  'pending',
  'paid',
  'overdue'
);

create type meal_type as enum (
  'dejeuner',
  'diner',
  'cocktail',
  'petit_dejeuner',
  'autre'
);

-- ============================================================
-- TABLE : companies (entreprises clientes)
-- ============================================================

create table companies (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  siret           text unique,
  address         text,
  city            text,
  zip_code        text,
  oeth_eligible   boolean not null default false,
  budget_annual   numeric(12, 2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE : caterers (ESAT/EA)
-- ============================================================

create table caterers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  siret           text unique,
  -- CRUCIAL pour le calcul AGEFIPH
  esat_status     boolean not null default false,
  address         text,
  city            text,
  zip_code        text,
  description     text,
  specialties     text[] default '{}',
  photos          text[] default '{}',
  capacity_min    integer,
  capacity_max    integer,
  is_validated    boolean not null default false,
  -- Taux de commission plateforme (5% par défaut)
  commission_rate numeric(5, 4) not null default 0.05,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE : users (profils étendus — complète auth.users)
-- ============================================================

create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  first_name      text,
  last_name       text,
  role            user_role not null default 'client_user',
  -- Lien entreprise cliente (null pour traiteur et super_admin)
  company_id      uuid references companies(id) on delete set null,
  -- Lien ESAT (null pour client et super_admin)
  caterer_id      uuid references caterers(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint users_role_company_check check (
    (role in ('client_admin', 'client_user') and company_id is not null) or
    (role = 'caterer' and caterer_id is not null) or
    (role = 'super_admin')
  )
);

-- ============================================================
-- TABLE : quote_requests (demandes de devis)
-- ============================================================

create table quote_requests (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  client_user_id        uuid not null references users(id),
  company_id            uuid not null references companies(id),
  event_date            date not null,
  event_start_time      time,
  event_end_time        time,
  event_address         text not null,
  guest_count           integer not null check (guest_count > 0),
  -- Budget bidirectionnel : les deux champs sont stockés, synchronisés via trigger
  budget_global         numeric(12, 2),
  budget_per_person     numeric(10, 2),
  budget_flexibility    text check (budget_flexibility in ('none', '5', '10')),
  meal_type             meal_type not null,
  -- Journée complète (2 prestations)
  is_full_day           boolean not null default false,
  meal_type_secondary   meal_type,
  -- Contraintes alimentaires
  dietary_vegetarian    boolean not null default false,
  dietary_vegan         boolean not null default false,
  dietary_halal         boolean not null default false,
  dietary_kosher        boolean not null default false,
  dietary_gluten_free   boolean not null default false,
  dietary_other         text,
  -- Boissons
  drinks_included       boolean not null default false,
  drinks_details        text,
  -- Services additionnels
  service_waitstaff     boolean not null default false,
  service_equipment     boolean not null default false,
  service_decoration    boolean not null default false,
  service_other         text,
  -- Description libre
  description           text,
  -- Statut et suivi admin
  status                quote_request_status not null default 'pending_review',
  super_admin_notes     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Trigger : synchronise budget_global ↔ budget_per_person
create or replace function sync_budget()
returns trigger as $$
begin
  -- Si budget_global change, recalcule budget_per_person
  if NEW.budget_global is not null and NEW.guest_count > 0 and
     (OLD.budget_global is distinct from NEW.budget_global) then
    NEW.budget_per_person := round(NEW.budget_global / NEW.guest_count, 2);
  -- Si budget_per_person change, recalcule budget_global
  elsif NEW.budget_per_person is not null and NEW.guest_count > 0 and
        (OLD.budget_per_person is distinct from NEW.budget_per_person) then
    NEW.budget_global := round(NEW.budget_per_person * NEW.guest_count, 2);
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

create trigger quote_request_budget_sync
  before insert or update on quote_requests
  for each row execute function sync_budget();

-- ============================================================
-- TABLE : quote_request_caterers (table pivot)
-- Règle des 3 premiers répondants
-- ============================================================

create table quote_request_caterers (
  id                  uuid primary key default uuid_generate_v4(),
  quote_request_id    uuid not null references quote_requests(id) on delete cascade,
  caterer_id          uuid not null references caterers(id),
  status              quote_request_caterer_status not null default 'selected',
  -- Horodatage de la réponse (pour appliquer la règle des 3 premiers)
  responded_at        timestamptz,
  -- Rang de réponse (1, 2, 3 → transmis ; null ou >3 → non transmis)
  response_rank       integer,
  created_at          timestamptz not null default now(),
  unique (quote_request_id, caterer_id)
);

-- Trigger : applique la règle des 3 premiers répondants
create or replace function apply_three_responders_rule()
returns trigger as $$
declare
  v_rank integer;
begin
  if NEW.status = 'responded' and NEW.responded_at is null then
    NEW.responded_at := now();

    -- Compte combien ont déjà répondu sur cette demande
    select count(*) + 1 into v_rank
    from quote_request_caterers
    where quote_request_id = NEW.quote_request_id
      and status = 'responded'
      and id != NEW.id;

    NEW.response_rank := v_rank;

    -- Si parmi les 3 premiers, on transmet au client
    if v_rank <= 3 then
      NEW.status := 'transmitted_to_client';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger quote_request_caterer_rank
  before update on quote_request_caterers
  for each row
  when (OLD.status != 'responded' and NEW.status = 'responded')
  execute function apply_three_responders_rule();

-- ============================================================
-- TABLE : quotes (devis envoyés par les traiteurs)
-- ============================================================

create table quotes (
  id                    uuid primary key default uuid_generate_v4(),
  quote_request_id      uuid not null references quote_requests(id),
  caterer_id            uuid not null references caterers(id),
  total_amount_ht       numeric(12, 2) not null,
  amount_per_person     numeric(10, 2),
  -- CRUCIAL AGEFIPH : montant valorisable pour la déclaration OETH
  valorisable_agefiph   numeric(12, 2),
  -- Lignes de devis (JSON structuré)
  details               jsonb default '[]',
  valid_until           date,
  status                quote_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- TABLE : orders (commandes)
-- ============================================================

create table orders (
  id                  uuid primary key default uuid_generate_v4(),
  quote_id            uuid not null references quotes(id),
  client_admin_id     uuid not null references users(id),
  status              order_status not null default 'confirmed',
  delivery_date       timestamptz not null,
  delivery_address    text not null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- TABLE : invoices (factures — modèle facture directe ESAT)
-- IMPORTANT : Ne jamais générer le numéro de facture ESAT !
-- La plateforme stocke uniquement la référence fournie par l'ESAT.
-- ============================================================

create table invoices (
  id                    uuid primary key default uuid_generate_v4(),
  -- Référence fournie par l'ESAT (NE PAS générer côté plateforme)
  esat_invoice_ref      text,
  order_id              uuid not null references orders(id),
  caterer_id            uuid not null references caterers(id),
  amount_ht             numeric(12, 2) not null,
  tva_rate              numeric(5, 4) not null default 0.10,
  amount_ttc            numeric(12, 2) not null,
  -- CRUCIAL AGEFIPH
  valorisable_agefiph   numeric(12, 2),
  -- Mention légale obligatoire sur les factures ESAT
  esat_mention          text default 'Établissement ou Service d''Aide par le Travail (ESAT) — Achat auprès d''un ESAT ouvrant droit à déduction AGEFIPH',
  issued_at             timestamptz,
  due_at                timestamptz,
  paid_at               timestamptz,
  status                invoice_status not null default 'pending',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- TABLE : commission_invoices (factures de commission plateforme)
-- 5% côté client + 5% côté traiteur = distincte de la facture ESAT
-- ============================================================

create table commission_invoices (
  id              uuid primary key default uuid_generate_v4(),
  -- Numérotation séquentielle plateforme (pas côté ESAT)
  invoice_number  text unique not null,
  order_id        uuid not null references orders(id),
  -- Partie client ou traiteur
  party           text not null check (party in ('client', 'caterer')),
  amount_ht       numeric(12, 2) not null,
  tva_rate        numeric(5, 4) not null default 0.20,
  amount_ttc      numeric(12, 2) not null,
  issued_at       timestamptz not null default now(),
  paid_at         timestamptz,
  status          invoice_status not null default 'pending',
  created_at      timestamptz not null default now()
);

-- Séquence pour la numérotation des factures de commission
create sequence commission_invoice_seq start 1000;

-- ============================================================
-- TABLE : notifications
-- ============================================================

create table notifications (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users(id) on delete cascade,
  type                  text not null,
  title                 text not null,
  body                  text,
  is_read               boolean not null default false,
  related_entity_type   text,
  related_entity_id     uuid,
  created_at            timestamptz not null default now()
);

-- Index pour la récupération rapide des notifs non lues
create index notifications_user_unread_idx
  on notifications(user_id, is_read)
  where is_read = false;

-- ============================================================
-- TABLE : messages (messagerie interne)
-- ============================================================

create table messages (
  id                  uuid primary key default uuid_generate_v4(),
  thread_id           uuid not null,
  sender_id           uuid not null references users(id),
  recipient_id        uuid not null references users(id),
  -- Contexte (soit commande soit demande de devis)
  order_id            uuid references orders(id),
  quote_request_id    uuid references quote_requests(id),
  body                text not null,
  is_read             boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint messages_context_check check (
    (order_id is not null) or (quote_request_id is not null)
  )
);

create index messages_thread_idx on messages(thread_id, created_at);
create index messages_recipient_unread_idx
  on messages(recipient_id, is_read)
  where is_read = false;

-- ============================================================
-- TRIGGERS updated_at génériques
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

create trigger companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

create trigger caterers_updated_at
  before update on caterers
  for each row execute function set_updated_at();

create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger quotes_updated_at
  before update on quotes
  for each row execute function set_updated_at();

create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ============================================================
-- FUNCTION : auto-création du profil user après inscription
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into users (id, email, role)
  values (
    NEW.id,
    NEW.email,
    coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'client_user')
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
