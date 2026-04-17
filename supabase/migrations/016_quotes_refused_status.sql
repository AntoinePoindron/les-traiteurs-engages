-- Ajoute la valeur 'quotes_refused' à l'enum quote_request_status
-- Utilisée quand le client a refusé tous les devis reçus sur une demande

alter type quote_request_status add value if not exists 'quotes_refused';

-- Met à jour la policy RLS pour autoriser les clients à passer
-- une demande au statut 'quotes_refused' (en plus de 'completed')

drop policy if exists "quote_requests_update_complete" on quote_requests;

create policy "quote_requests_update_client" on quote_requests
  for update
  using (
    auth_role() in ('client_user', 'client_admin')
    and (
      client_user_id = auth.uid()
      or (auth_role() = 'client_admin' and company_id = auth_company_id())
    )
    and status in ('sent_to_caterers', 'approved')
  )
  with check (
    status in ('completed', 'quotes_refused')
  );
