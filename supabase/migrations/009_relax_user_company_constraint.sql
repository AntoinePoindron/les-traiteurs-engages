-- La contrainte users_role_company_check bloque la création de users via Supabase Auth
-- car le trigger handle_new_user() insère sans company_id.
-- On assouplit : company_id peut être null à la création, il sera mis à jour ensuite.

alter table users drop constraint users_role_company_check;

alter table users add constraint users_role_company_check check (
  (role = 'caterer'     and caterer_id is not null) or
  (role = 'super_admin') or
  (role in ('client_admin', 'client_user'))
);
