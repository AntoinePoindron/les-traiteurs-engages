-- ================================================================
-- Migration 022 : client_admin inclus dans company_employees
-- ================================================================
-- Par défaut, chaque entreprise a un service "Direction" et son
-- administrateur y est rattaché. Cela permet à l'admin d'apparaître
-- dans la section Effectifs et d'avoir ses demandes/commandes
-- catégorisées sous un service par défaut.
--
-- Cette migration :
--   1. Crée le service "Direction" pour chaque entreprise existante
--      qui n'en a pas déjà un.
--   2. Crée une ligne company_employees pour chaque client_admin
--      existant qui n'en a pas déjà une, avec service_id = Direction.
--
-- Pour les nouveaux client_admin, la création est gérée par le code
-- applicatif (signup action) au moment de la création du compte.
-- ================================================================

-- 1. Backfill : un service "Direction" par entreprise
insert into company_services (company_id, name, annual_budget)
select c.id, 'Direction', 0
from companies c
where not exists (
  select 1 from company_services cs
  where cs.company_id = c.id
    and cs.name = 'Direction'
);

-- 2. Backfill : une ligne company_employees par client_admin
insert into company_employees (company_id, service_id, user_id, first_name, last_name, email, position)
select
  u.company_id,
  (select id from company_services
    where company_id = u.company_id
      and name = 'Direction'
    order by created_at asc
    limit 1
  ) as service_id,
  u.id,
  coalesce(u.first_name, ''),
  coalesce(u.last_name,  ''),
  u.email,
  'Administrateur'
from users u
where u.role = 'client_admin'
  and u.company_id is not null
  and u.membership_status = 'active'
  and not exists (
    select 1 from company_employees e
    where e.user_id = u.id
  );

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
