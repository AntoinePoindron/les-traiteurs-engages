-- ============================================================
-- Reset des données transactionnelles — dev / staging uniquement
-- ============================================================
--
-- Ce script efface :
--   ✓ les commandes (orders)
--   ✓ les demandes de devis (quote_requests) et leurs liaisons qrc
--   ✓ les devis (quotes)
--   ✓ les paiements Stripe (payments)
--   ✓ les factures legacy locales (invoices)
--   ✓ les factures de commission plateforme (commission_invoices)
--   ✓ les messages internes (messages)
--   ✓ les notifications liées (order / quote / quote_request)
--
-- Il PRÉSERVE :
--   ✓ les utilisateurs (users), leur rôle et leur stripe_customer_id
--   ✓ les traiteurs (caterers) et leur config Stripe Connect
--   ✓ les entreprises clientes (companies)
--   ✓ les services internes (company_services)
--   ✓ les effectifs (company_employees)
--   ✓ les notifications non transactionnelles (collaborator_pending, etc.)
--
-- À exécuter dans Supabase Studio → SQL Editor → Run.
-- Toutes les opérations sont dans une transaction : si une étape
-- échoue, rien n'est appliqué. Safe à ré-exécuter.
--
-- Ne touche PAS à Stripe. Si tu veux aussi purger les customers,
-- invoices, subscriptions côté Stripe → Dashboard Stripe (mode test)
-- → Developers → Clear test data.

BEGIN;

-- 1. Paiements (FK vers orders)
DELETE FROM payments;

-- 2. Factures legacy locales (FK vers orders, héritage avant Stripe)
DELETE FROM invoices;

-- 3. Factures de commission plateforme (FK vers orders)
DELETE FROM commission_invoices;

-- 4. Commandes (FK vers quotes)
DELETE FROM orders;

-- 5. Messages liés à des demandes. `messages.quote_request_id`
--    pointe sur quote_requests — si on clean les demandes sans
--    avoir nettoyé les messages, la FK casse.
DELETE FROM messages;

-- 6. Devis (FK vers quote_requests)
DELETE FROM quotes;

-- 7. Liaisons traiteurs ↔ demandes
DELETE FROM quote_request_caterers;

-- 8. Demandes de devis
DELETE FROM quote_requests;

-- 9. Notifications transactionnelles uniquement. On garde les
--    `collaborator_pending` / `collaborator_approved` /
--    `new_caterer_signup` qui ne dépendent pas des demandes/commandes.
DELETE FROM notifications
WHERE related_entity_type IN ('order', 'quote', 'quote_request');

-- Optionnel : reset aussi les notifs "orphelines" sans entité liée
-- qui se rapportent au flow transactionnel (par type)
DELETE FROM notifications
WHERE type IN (
  'quote_request_received',
  'quote_accepted',
  'quote_refused',
  'quote_received',
  'order_delivered',
  'invoice_issued',
  'invoice_paid',
  'payment_failed',
  'order_cancelled',
  'dispute_opened',
  'dispute_opened_admin',
  'new_request_to_qualify'
);

COMMIT;

-- Sanity check post-exécution (à lancer après le COMMIT pour vérifier)
-- Décommenter les lignes ci-dessous pour vérifier que tout est bien à zéro.
--
-- SELECT 'payments'               AS table_name, COUNT(*) FROM payments
-- UNION ALL SELECT 'orders',                        COUNT(*) FROM orders
-- UNION ALL SELECT 'quotes',                        COUNT(*) FROM quotes
-- UNION ALL SELECT 'quote_request_caterers',        COUNT(*) FROM quote_request_caterers
-- UNION ALL SELECT 'quote_requests',                COUNT(*) FROM quote_requests
-- UNION ALL SELECT 'messages',                      COUNT(*) FROM messages
-- UNION ALL SELECT 'notifications_tx',              COUNT(*) FROM notifications WHERE related_entity_type IN ('order', 'quote', 'quote_request');
