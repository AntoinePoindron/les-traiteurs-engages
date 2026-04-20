-- ================================================================
-- Migration 024 : table payments
-- ================================================================
-- Une ligne par tentative de paiement Stripe liée à une commande.
-- Même si une commande est payée plusieurs fois (peu probable mais
-- possible en cas de retry), on trace chaque tentative.
--
-- Tous les montants sont en CENTIMES (convention Stripe) pour éviter
-- les erreurs d'arrondi flottant.
--
-- application_fee_cents = commission plateforme
-- amount_to_caterer_cents = ce qui va sur le compte connecté traiteur
-- amount_to_caterer_cents + application_fee_cents = amount_total_cents
-- ================================================================

create table if not exists payments (
  id                         uuid primary key default gen_random_uuid(),
  order_id                   uuid not null references orders(id) on delete cascade,
  caterer_id                 uuid not null references caterers(id) on delete restrict,

  -- Références Stripe (l'un ou l'autre peut être null jusqu'au webhook)
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,

  -- Cycle de vie
  status                     text not null default 'pending',
    -- pending | processing | succeeded | failed | refunded | canceled
  amount_total_cents         integer not null,
  application_fee_cents      integer not null,
  amount_to_caterer_cents    integer not null,
  currency                   text not null default 'eur',

  -- Timeline
  created_at                 timestamptz not null default now(),
  succeeded_at               timestamptz,
  refunded_at                timestamptz,

  -- Méta
  failure_reason             text,
  last_event_at              timestamptz
);

-- Index pour lookup webhook
create index if not exists payments_session_idx on payments(stripe_checkout_session_id);
create index if not exists payments_intent_idx  on payments(stripe_payment_intent_id);
create index if not exists payments_order_idx   on payments(order_id);
create index if not exists payments_caterer_idx on payments(caterer_id);

-- RLS
alter table payments enable row level security;

-- Le client voit les paiements de ses commandes
create policy "payments_select_client" on payments
  for select using (
    exists (
      select 1 from orders o
      where o.id = payments.order_id
        and (
          o.client_admin_id = auth.uid()
          or exists (
            select 1 from quotes q
            join quote_requests qr on qr.id = q.quote_request_id
            where q.id = o.quote_id
              and qr.client_user_id = auth.uid()
          )
        )
    )
  );

-- Le traiteur voit les paiements de ses propres commandes
create policy "payments_select_caterer" on payments
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.caterer_id = payments.caterer_id
    )
  );

-- Le super admin voit tout
create policy "payments_select_admin" on payments
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.role = 'super_admin'
    )
  );

-- Aucune policy INSERT/UPDATE/DELETE : seul le service role peut écrire
-- depuis le webhook /api/webhooks/stripe et les server actions Stripe.

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
