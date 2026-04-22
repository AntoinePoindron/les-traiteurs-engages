-- ================================================================
-- Migration 025 : colonnes pour Stripe Invoicing
-- ================================================================
-- Passage du modèle "pay-first via Checkout" au modèle "invoice-first" :
-- après livraison, on émet une facture Stripe officielle. Le client paye
-- (carte ou virement SEPA) sur la hosted invoice page.
--
--   - users.stripe_customer_id : Stripe Customer rattaché au client,
--     réutilisé entre ses commandes pour concentrer son historique.
--   - orders.stripe_invoice_id : facture Stripe (in_…) rattachée à
--     la commande.
--   - orders.stripe_hosted_invoice_url : URL pratique à rediriger
--     le client vers la facture payable (snapshot au moment de la
--     finalisation).
-- ================================================================

alter table users
  add column if not exists stripe_customer_id text unique;

alter table orders
  add column if not exists stripe_invoice_id          text unique,
  add column if not exists stripe_hosted_invoice_url  text;

-- Sur payments, on ajoute la référence facture + charge pour que le
-- webhook invoice.paid puisse retrouver (ou créer) la bonne ligne, et
-- pour que l'historique plateforme affiche la facture source du paiement.
alter table payments
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_charge_id  text;

create index if not exists payments_invoice_idx on payments(stripe_invoice_id);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
