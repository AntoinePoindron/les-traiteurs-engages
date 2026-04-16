-- Migration 006 : Visibilité étendue pour la messagerie
-- ============================================================
-- Un utilisateur doit pouvoir voir le profil (et la société)
-- des personnes avec lesquelles il a échangé des messages.
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
drop policy "users_select" on users;
create policy "users_select" on users for select
  using (
    id = auth.uid()
    or auth_role() = 'super_admin'
    or (auth_role() = 'client_admin' and company_id = auth_company_id())
    -- Traiteur : peut voir le contact des demandes assignées
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
    -- Tout utilisateur peut voir les profils des gens avec qui il a des messages
    or exists (
      select 1 from messages m
      where (m.sender_id = auth.uid() and m.recipient_id = users.id)
         or (m.recipient_id = auth.uid() and m.sender_id = users.id)
    )
  );

-- ── companies ─────────────────────────────────────────────────
drop policy "companies_select" on companies;
create policy "companies_select" on companies for select
  using (
    auth_role() = 'super_admin'
    or id = auth_company_id()
    -- Traiteur : companies liées à ses demandes assignées
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
    -- Tout utilisateur peut voir la société des gens avec qui il a des messages
    or exists (
      select 1 from users u
      where u.company_id = companies.id
        and exists (
          select 1 from messages m
          where (m.sender_id = auth.uid() and m.recipient_id = u.id)
             or (m.recipient_id = auth.uid() and m.sender_id = u.id)
        )
    )
  );
