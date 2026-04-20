-- ================================================================
-- Migration 023 : colonnes Stripe Connect sur caterers
-- ================================================================
-- Chaque traiteur a son propre compte connecté Stripe (Accounts V2,
-- dashboard Express). On stocke ici les champs nécessaires pour
-- l'onboarding et le flow de paiement.
--
-- - stripe_account_id : l'id renvoyé par POST /v2/core/accounts
-- - stripe_onboarded_at : rempli une fois l'onboarding KYC terminé
--   (via webhook v2.core.account[configuration.recipient].capability_status_updated)
-- - stripe_charges_enabled / stripe_payouts_enabled : flags miroir des
--   capabilities Stripe, servent à bloquer un paiement si l'onboarding
--   n'est pas complet.
-- ================================================================

alter table caterers
  add column if not exists stripe_account_id       text unique,
  add column if not exists stripe_onboarded_at     timestamptz,
  add column if not exists stripe_charges_enabled  boolean not null default false,
  add column if not exists stripe_payouts_enabled  boolean not null default false;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
