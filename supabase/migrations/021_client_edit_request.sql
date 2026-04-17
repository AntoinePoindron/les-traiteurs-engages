-- Autorise les clients à modifier le CONTENU de leur demande (hors statut)
-- tant que la demande est en phase pré-devis.
--
-- La policy existante `quote_requests_update_client` (migration 016) ne permet
-- que la transition de statut vers 'completed' ou 'quotes_refused' (annulation
-- ou refus de tous les devis). Elle bloque silencieusement toute modification
-- de contenu.
--
-- Cette nouvelle policy s'ajoute (elles sont OR-ées en Postgres RLS). Elle
-- autorise l'update tant que le statut reste dans l'ensemble pré-devis,
-- c'est-à-dire qu'elle garantit qu'une édition de contenu ne peut pas
-- changer le statut.

create policy "quote_requests_update_content_client" on quote_requests
  for update
  using (
    auth_role() in ('client_user', 'client_admin')
    and (
      client_user_id = auth.uid()
      or (auth_role() = 'client_admin' and company_id = auth_company_id())
    )
    and status in ('pending_review', 'approved', 'sent_to_caterers')
  )
  with check (
    status in ('pending_review', 'approved', 'sent_to_caterers')
  );
