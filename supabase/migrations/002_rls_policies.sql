-- ============================================================
-- LES TRAITEURS ENGAGÉS — Row Level Security
-- Migration 002 : Politiques RLS pour les 4 rôles
--
-- Rôles :
--   client_admin  → vue globale entreprise
--   client_user   → ses propres demandes
--   caterer       → ses demandes/commandes/devis
--   super_admin   → accès total
-- ============================================================

-- Enable RLS on all tables
alter table companies              enable row level security;
alter table caterers               enable row level security;
alter table users                  enable row level security;
alter table quote_requests         enable row level security;
alter table quote_request_caterers enable row level security;
alter table quotes                 enable row level security;
alter table orders                 enable row level security;
alter table invoices               enable row level security;
alter table commission_invoices    enable row level security;
alter table notifications          enable row level security;
alter table messages               enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Retourne le rôle de l'utilisateur courant
create or replace function auth_role()
returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;

-- Retourne le company_id de l'utilisateur courant
create or replace function auth_company_id()
returns uuid as $$
  select company_id from users where id = auth.uid();
$$ language sql stable security definer;

-- Retourne le caterer_id de l'utilisateur courant
create or replace function auth_caterer_id()
returns uuid as $$
  select caterer_id from users where id = auth.uid();
$$ language sql stable security definer;

-- ============================================================
-- TABLE : users
-- ============================================================

-- Lecture : chacun voit son propre profil + super_admin voit tout
create policy "users_select" on users for select
  using (
    id = auth.uid()
    or auth_role() = 'super_admin'
    -- client_admin voit les users de sa company
    or (auth_role() = 'client_admin' and company_id = auth_company_id())
  );

-- Mise à jour : son propre profil uniquement (ou super_admin)
create policy "users_update" on users for update
  using (id = auth.uid() or auth_role() = 'super_admin')
  with check (id = auth.uid() or auth_role() = 'super_admin');

-- Insert géré par le trigger handle_new_user (service_role)
-- Super admin peut insérer
create policy "users_insert" on users for insert
  with check (auth_role() = 'super_admin' or id = auth.uid());

-- ============================================================
-- TABLE : companies
-- ============================================================

create policy "companies_select" on companies for select
  using (
    auth_role() = 'super_admin'
    or id = auth_company_id()
  );

create policy "companies_update" on companies for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'client_admin' and id = auth_company_id())
  );

create policy "companies_insert" on companies for insert
  with check (auth_role() = 'super_admin');

-- ============================================================
-- TABLE : caterers
-- ============================================================

-- Tout le monde peut voir les traiteurs validés (pour la recherche)
create policy "caterers_select_validated" on caterers for select
  using (
    is_validated = true
    or auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and id = auth_caterer_id())
  );

-- Mise à jour : le traiteur son propre profil, super_admin tout
create policy "caterers_update" on caterers for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and id = auth_caterer_id())
  );

create policy "caterers_insert" on caterers for insert
  with check (auth_role() = 'super_admin');

-- ============================================================
-- TABLE : quote_requests
-- ============================================================

create policy "quote_requests_select" on quote_requests for select
  using (
    auth_role() = 'super_admin'
    -- Le déposant
    or client_user_id = auth.uid()
    -- Tout admin de la company
    or (auth_role() = 'client_admin' and company_id = auth_company_id())
    -- Traiteurs : uniquement ceux qui ont été sélectionnés sur la demande
    or (
      auth_role() = 'caterer'
      and exists (
        select 1 from quote_request_caterers qrc
        where qrc.quote_request_id = id
          and qrc.caterer_id = auth_caterer_id()
          and qrc.status in ('selected', 'responded', 'transmitted_to_client')
      )
    )
  );

create policy "quote_requests_insert" on quote_requests for insert
  with check (
    -- Un client_user ou client_admin peut créer une demande pour sa company
    auth_role() in ('client_user', 'client_admin')
    and company_id = auth_company_id()
    and client_user_id = auth.uid()
  );

create policy "quote_requests_update" on quote_requests for update
  using (
    auth_role() = 'super_admin'
    or (
      auth_role() in ('client_user', 'client_admin')
      and client_user_id = auth.uid()
      and status = 'draft'
    )
  );

-- ============================================================
-- TABLE : quote_request_caterers
-- ============================================================

create policy "qrc_select" on quote_request_caterers for select
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
    or exists (
      select 1 from quote_requests qr
      where qr.id = quote_request_id
        and (
          qr.client_user_id = auth.uid()
          or (auth_role() = 'client_admin' and qr.company_id = auth_company_id())
        )
    )
  );

create policy "qrc_insert" on quote_request_caterers for insert
  with check (auth_role() = 'super_admin');

create policy "qrc_update" on quote_request_caterers for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
  );

-- ============================================================
-- TABLE : quotes
-- ============================================================

create policy "quotes_select" on quotes for select
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
    -- Client voit les devis transmis uniquement
    or (
      auth_role() in ('client_user', 'client_admin')
      and exists (
        select 1 from quote_request_caterers qrc
        join quote_requests qr on qr.id = qrc.quote_request_id
        where qrc.quote_request_id = quote_request_id
          and qrc.caterer_id = caterer_id
          and qrc.status = 'transmitted_to_client'
          and (
            qr.client_user_id = auth.uid()
            or (auth_role() = 'client_admin' and qr.company_id = auth_company_id())
          )
      )
    )
  );

create policy "quotes_insert" on quotes for insert
  with check (
    auth_role() = 'caterer' and caterer_id = auth_caterer_id()
  );

create policy "quotes_update" on quotes for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id() and status = 'draft')
  );

-- ============================================================
-- TABLE : orders
-- ============================================================

create policy "orders_select" on orders for select
  using (
    auth_role() = 'super_admin'
    or client_admin_id = auth.uid()
    or (
      auth_role() = 'client_admin'
      and exists (
        select 1 from quotes q
        join quote_requests qr on qr.id = q.quote_request_id
        where q.id = quote_id and qr.company_id = auth_company_id()
      )
    )
    or (
      auth_role() = 'caterer'
      and exists (
        select 1 from quotes q
        where q.id = quote_id and q.caterer_id = auth_caterer_id()
      )
    )
  );

create policy "orders_insert" on orders for insert
  with check (
    auth_role() = 'client_admin'
    and client_admin_id = auth.uid()
  );

create policy "orders_update" on orders for update
  using (
    auth_role() = 'super_admin'
    or (
      auth_role() = 'caterer'
      and exists (
        select 1 from quotes q where q.id = quote_id and q.caterer_id = auth_caterer_id()
      )
    )
    or (auth_role() = 'client_admin' and client_admin_id = auth.uid())
  );

-- ============================================================
-- TABLE : invoices
-- ============================================================

create policy "invoices_select" on invoices for select
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
    or (
      auth_role() = 'client_admin'
      and exists (
        select 1 from orders o
        join quotes q on q.id = o.quote_id
        join quote_requests qr on qr.id = q.quote_request_id
        where o.id = order_id and qr.company_id = auth_company_id()
      )
    )
  );

-- Seul le traiteur saisit sa référence de facture
-- (la plateforme ne génère jamais le numéro ESAT)
create policy "invoices_insert" on invoices for insert
  with check (
    auth_role() = 'caterer' and caterer_id = auth_caterer_id()
  );

create policy "invoices_update" on invoices for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
  );

-- ============================================================
-- TABLE : commission_invoices
-- ============================================================

create policy "commission_invoices_select" on commission_invoices for select
  using (
    auth_role() = 'super_admin'
    or (
      auth_role() = 'caterer'
      and party = 'caterer'
      and exists (
        select 1 from orders o
        join quotes q on q.id = o.quote_id
        where o.id = order_id and q.caterer_id = auth_caterer_id()
      )
    )
    or (
      auth_role() = 'client_admin'
      and party = 'client'
      and exists (
        select 1 from orders o
        join quotes q on q.id = o.quote_id
        join quote_requests qr on qr.id = q.quote_request_id
        where o.id = order_id and qr.company_id = auth_company_id()
      )
    )
  );

-- Seul super_admin crée les factures de commission
create policy "commission_invoices_insert" on commission_invoices for insert
  with check (auth_role() = 'super_admin');

-- ============================================================
-- TABLE : notifications
-- ============================================================

create policy "notifications_select" on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Les notifications sont créées par des fonctions serveur (service_role)
-- ou par super_admin
create policy "notifications_insert" on notifications for insert
  with check (auth_role() = 'super_admin');

-- ============================================================
-- TABLE : messages
-- ============================================================

create policy "messages_select" on messages for select
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or auth_role() = 'super_admin'
  );

create policy "messages_insert" on messages for insert
  with check (sender_id = auth.uid());

create policy "messages_update" on messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
