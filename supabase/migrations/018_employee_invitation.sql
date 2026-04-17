-- ================================================================
-- Migration 018 : invitation des collaborateurs par email
-- ================================================================
-- Quand un admin ajoute un effectif avec un email, on envoie une
-- invitation. Tant que l'invité ne s'est pas inscrit, sa ligne dans
-- company_employees a `invited_at` rempli et `user_id` null
-- → statut UI "En attente de réponse".
--
-- Quand l'invité s'inscrit (via Supabase Auth invite ou /signup avec
-- le même email), le trigger handle_new_user le rattache automatiquement
-- à la company (membership_status = 'active', sans validation admin
-- supplémentaire) et lie company_employees.user_id à son id.
-- ================================================================

-- ── Colonnes ───────────────────────────────────────────────────
alter table company_employees
  add column if not exists invited_at timestamptz,
  add column if not exists user_id    uuid references users(id) on delete set null;

create index if not exists company_employees_user_id_idx
  on company_employees(user_id)
  where user_id is not null;

-- ── Trigger handle_new_user mis à jour ─────────────────────────
-- Si l'email du nouveau user correspond à un company_employee invité
-- (invited_at non null, user_id null) → rattachement automatique.
-- Sinon, comportement standard (insert minimal, le profil sera complété
-- par le wizard signup ou par défaut).

-- Note : on utilise un tag dollar nommé ($func$) plutôt que $$ pour
-- éviter les problèmes de parsing du SQL Editor Supabase Dashboard.
create or replace function handle_new_user()
returns trigger as $func$
declare
  invited_emp record;
begin
  select id, company_id, first_name, last_name
    into invited_emp
    from company_employees
   where lower(email) = lower(NEW.email)
     and invited_at is not null
     and user_id is null
   limit 1;

  if invited_emp.id is not null then
    -- User invité par un admin → rattachement direct à la company,
    -- statut actif (pas besoin de validation supplémentaire).
    insert into users (id, email, role, first_name, last_name, company_id, membership_status)
    values (
      NEW.id,
      NEW.email,
      'client_user',
      coalesce((NEW.raw_user_meta_data->>'first_name'), invited_emp.first_name),
      coalesce((NEW.raw_user_meta_data->>'last_name'),  invited_emp.last_name),
      invited_emp.company_id,
      'active'
    );

    -- Lier l'effectif au user nouvellement créé
    update company_employees
       set user_id = NEW.id
     where id = invited_emp.id;
  else
    -- Comportement standard
    insert into users (id, email, role)
    values (
      NEW.id,
      NEW.email,
      coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'client_user')
    );
  end if;

  return NEW;
end;
$func$ language plpgsql security definer;

-- Force PostgREST à recharger son schema cache
notify pgrst, 'reload schema';
