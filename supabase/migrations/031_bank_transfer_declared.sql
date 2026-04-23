-- ============================================================
-- Migration 031 : trace de la déclaration d'émission du virement
-- ============================================================
-- Le client peut déclarer "j'ai effectué le virement" depuis la page
-- détail commande (auto-déclaration, trust-based). Ça permet d'afficher
-- un statut intermédiaire "Virement en cours" entre "À payer" et
-- "Payée", pendant les 1-3 jours ouvrés SEPA.
--
-- Stripe ne fournit PAS d'event "virement émis" — les rails SEPA ne
-- notifient la banque destinataire qu'à la réception. Cette colonne
-- comble ce trou UX.
--
-- La source de vérité reste le webhook `invoice.paid` qui bascule
-- orders.status en 'paid'. Si un client déclare sans avoir vraiment
-- viré, aucun impact sur la DB (l'ordre reste en delivered/invoiced).

alter table orders
  add column bank_transfer_declared_at timestamptz;

-- Pas d'index : cette colonne n'est jamais utilisée comme filtre
-- principal, on la lit juste sur le détail d'une commande.

comment on column orders.bank_transfer_declared_at is
  'Timestamp de déclaration par le client qu''un virement a été émis. NULL si pas encore déclaré. Affichage UI uniquement — la source de vérité pour le statut "payé" reste le webhook Stripe invoice.paid.';
