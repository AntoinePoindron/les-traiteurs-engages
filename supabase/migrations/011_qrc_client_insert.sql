-- Autoriser un client à insérer dans quote_request_caterers
-- pour sa propre demande (demande directe depuis une fiche traiteur).

drop policy if exists "qrc_insert" on quote_request_caterers;

create policy "qrc_insert" on quote_request_caterers for insert
  with check (
    auth_role() = 'super_admin'
    or exists (
      select 1 from quote_requests qr
      where qr.id = quote_request_id
        and qr.client_user_id = auth.uid()
    )
  );
