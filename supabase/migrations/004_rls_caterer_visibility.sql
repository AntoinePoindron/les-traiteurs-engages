-- ============================================================
-- Migration 004 : Visibilité caterer sur companies + users clients
--
-- Un traiteur doit pouvoir voir :
--   - la société cliente des demandes qui lui sont assignées
--   - l'utilisateur client (contact) de ces mêmes demandes
-- ============================================================

-- ── companies ───────────────────────────────────────────────
drop policy "companies_select" on companies;
create policy "companies_select" on companies for select
  using (
    auth_role() = 'super_admin'
    or id = auth_company_id()
    -- Traiteur : peut voir les companies liées à ses demandes assignées
    or (
      auth_role() = 'caterer'
      and exists (
        select 1 from quote_requests qr
        join quote_request_caterers qrc on qrc.quote_request_id = qr.id
        where qr.company_id = companies.id
          and qrc.caterer_id = auth_caterer_id()
          and qrc.status in ('selected', 'responded', 'transmitted_to_client')
      )
    )
  );

-- ── users ────────────────────────────────────────────────────
drop policy "users_select" on users;
create policy "users_select" on users for select
  using (
    id = auth.uid()
    or auth_role() = 'super_admin'
    or (auth_role() = 'client_admin' and company_id = auth_company_id())
    -- Traiteur : peut voir le client (contact) des demandes assignées
    or (
      auth_role() = 'caterer'
      and exists (
        select 1 from quote_requests qr
        join quote_request_caterers qrc on qrc.quote_request_id = qr.id
        where qr.client_user_id = users.id
          and qrc.caterer_id = auth_caterer_id()
          and qrc.status in ('selected', 'responded', 'transmitted_to_client')
      )
    )
  );
