-- Migration 013 : Un client peut voir le profil utilisateur d'un traiteur
-- qui lui a transmis un devis (pour initier une conversation en messagerie).
-- Sans cette règle, recipientUserId est null côté client → bouton "Envoyer un
-- message" invisible car le premier message ne peut pas encore exister.

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
    -- Client : peut voir l'utilisateur d'un traiteur qui lui a transmis un devis
    or (
      auth_role() in ('client_user', 'client_admin')
      and users.caterer_id is not null
      and exists (
        select 1 from quotes q
        join quote_request_caterers qrc on qrc.caterer_id = q.caterer_id
                                       and qrc.quote_request_id = q.quote_request_id
        join quote_requests qr on qr.id = q.quote_request_id
        where q.caterer_id = users.caterer_id
          and qrc.status = 'transmitted_to_client'
          and (
            qr.client_user_id = auth.uid()
            or (auth_role() = 'client_admin' and qr.company_id = auth_company_id())
          )
      )
    )
  );
