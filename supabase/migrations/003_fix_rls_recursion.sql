-- ============================================================
-- Migration 003 : Correction récursion infinie RLS
--
-- Problème : quote_requests_select → EXISTS sur quote_request_caterers
--            qrc_select → EXISTS sur quote_requests
--            → boucle infinie dès qu'on joint les deux tables
--
-- Solution : fonctions security definer qui interrogent les tables
--            sans RLS, brisant le cycle.
-- ============================================================

-- Helper : le traiteur courant a-t-il accès à une demande donnée ?
create or replace function auth_caterer_can_see_request(p_request_id uuid)
returns boolean as $$
  select exists (
    select 1 from quote_request_caterers
    where quote_request_id = p_request_id
      and caterer_id = auth_caterer_id()
      and status in ('selected', 'responded', 'transmitted_to_client')
  );
$$ language sql stable security definer;

-- Helper : le client courant est-il propriétaire d'une demande ?
create or replace function auth_client_owns_request(p_request_id uuid)
returns boolean as $$
  select exists (
    select 1 from quote_requests
    where id = p_request_id
      and (
        client_user_id = auth.uid()
        or (auth_role() = 'client_admin' and company_id = auth_company_id())
      )
  );
$$ language sql stable security definer;

-- ── Recrée quote_requests_select sans référence directe à qrc ──
drop policy "quote_requests_select" on quote_requests;
create policy "quote_requests_select" on quote_requests for select
  using (
    auth_role() = 'super_admin'
    or client_user_id = auth.uid()
    or (auth_role() = 'client_admin' and company_id = auth_company_id())
    or (auth_role() = 'caterer' and auth_caterer_can_see_request(id))
  );

-- ── Recrée qrc_select sans référence directe à quote_requests ──
drop policy "qrc_select" on quote_request_caterers;
create policy "qrc_select" on quote_request_caterers for select
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id())
    or auth_client_owns_request(quote_request_id)
  );
