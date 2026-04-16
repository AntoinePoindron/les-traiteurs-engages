-- ============================================================
-- SEED — demandes de test tous statuts
-- user    : c025d0c8-9f18-4d02-85ce-fa59c2f88e9d (Antoine)
-- caterer : 9fab9fa6-409b-4d35-ab67-4a26b42d36b2 (ESAT test)
-- Supprimer les anciennes données avant de rejouer :
--   delete from quote_request_caterers where caterer_id = '9fab9fa6-409b-4d35-ab67-4a26b42d36b2';
--   delete from quotes where caterer_id = '9fab9fa6-409b-4d35-ab67-4a26b42d36b2';
--   delete from quote_requests where id like 'aaaaaaaa%';
-- ============================================================

-- ── Nouvelle #1 — Café Flore ─────────────────────────────────
insert into quote_requests (
  id, title, client_user_id, company_id,
  event_date, event_start_time, event_end_time, event_address,
  guest_count, meal_type,
  budget_global, budget_flexibility,
  drinks_included, drinks_details,
  service_waitstaff, service_equipment,
  dietary_vegetarian, dietary_halal,
  status, description
) values (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'Déjeuner d''équipe RH',
  'c025d0c8-9f18-4d02-85ce-fa59c2f88e9d', '039d57ae-4ea5-4ba6-8992-d642d05cb08c',
  current_date + 30, '12:00', '14:00', '172 boulevard Saint-Germain, Paris 75006',
  40, 'dejeuner',
  1600, '10',
  true, 'Eau, sodas, jus de fruits',
  true, false,
  true, true,
  'sent_to_caterers',
  'Nous organisons notre déjeuner annuel RH. Nous avons plusieurs collègues végétariens et halal. Merci de proposer des options adaptées pour chaque régime. Ambiance conviviale souhaitée.'
);
insert into quote_request_caterers (quote_request_id, caterer_id, status)
values ('aaaaaaaa-0001-0001-0001-000000000001', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2', 'selected');

-- ── Nouvelle #2 — SNCF Lyon ──────────────────────────────────
insert into quote_requests (
  id, title, client_user_id, company_id,
  event_date, event_start_time, event_address,
  guest_count, meal_type,
  budget_per_person,
  drinks_included, drinks_details,
  service_equipment,
  dietary_gluten_free,
  dietary_other,
  status, description
) values (
  'aaaaaaaa-0002-0002-0002-000000000002',
  'Petit-déjeuner réunion direction',
  'c025d0c8-9f18-4d02-85ce-fa59c2f88e9d', '9a987402-97e8-4200-a79b-5b5a8e2922c2',
  current_date + 14, '08:30', 'Gare de Lyon Part-Dieu, salle Confluence, Lyon 69003',
  25, 'petit_dejeuner',
  18,
  true, 'Café, thé, jus d''orange pressé',
  true,
  true,
  '1 personne allergique aux fruits à coque',
  'sent_to_caterers',
  'Réunion stratégique de la direction. Cadre sobre et professionnel. Nous avons besoin de la vaisselle et du matériel de service. Une personne est allergique aux fruits à coque, merci d''y être vigilant.'
);
insert into quote_request_caterers (quote_request_id, caterer_id, status)
values ('aaaaaaaa-0002-0002-0002-000000000002', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2', 'selected');

-- ── En attente — Danone Lyon ─────────────────────────────────
insert into quote_requests (
  id, title, client_user_id, company_id,
  event_date, event_start_time, event_end_time, event_address,
  guest_count, meal_type,
  budget_global, budget_flexibility,
  drinks_included, drinks_details,
  service_waitstaff, service_decoration,
  dietary_vegetarian, dietary_vegan, dietary_gluten_free,
  status, description
) values (
  'aaaaaaaa-0003-0003-0003-000000000003',
  'Cocktail dinatoire séminaire annuel',
  'c025d0c8-9f18-4d02-85ce-fa59c2f88e9d', 'c1662d2a-1910-4c4c-8380-f1e240f4aa8c',
  current_date + 45, '18:30', '22:00', '17 boulevard Vivier-Merle, Lyon 69003',
  70, 'cocktail',
  2800, '5',
  true, 'Champagne, vins blanc et rouge sélectionnés, bières artisanales, softs, eau',
  true, true,
  true, false, true,
  'sent_to_caterers',
  'Événement de clôture de notre séminaire annuel. Nous souhaitons une ambiance festive et chaleureuse. Plusieurs collaborateurs sont végétariens ou sans gluten. Merci de prévoir une belle décoration de table.'
);
insert into quote_request_caterers (quote_request_id, caterer_id, status, responded_at)
values ('aaaaaaaa-0003-0003-0003-000000000003', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2', 'responded', now() - interval '1 day');
insert into quotes (quote_request_id, caterer_id, reference, total_amount_ht, details, status, valid_until, notes)
values (
  'aaaaaaaa-0003-0003-0003-000000000003', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2',
  'DEVIS-2026-001', 2450.00,
  '[{"section":"main","label":"Plateau cocktail dinatoire","quantity":70,"unit_price_ht":28,"tva_rate":10,"description":"Assortiment chaud/froid, options végétariennes et sans gluten"},{"section":"drinks","label":"Champagne & vins","quantity":70,"unit_price_ht":7,"tva_rate":10,"description":"Champagne, blanc, rouge, bières, softs"},{"section":"extra","label":"Décoration florale","quantity":1,"unit_price_ht":350,"tva_rate":20,"description":"Centres de table et mise en scène"}]'::jsonb,
  'sent', current_date + 30,
  'Acompte de 30% à la signature. Solde à réception. Livraison et installation incluses.'
);

-- ── Devis accepté — Café Flore ───────────────────────────────
insert into quote_requests (
  id, title, client_user_id, company_id,
  event_date, event_start_time, event_end_time, event_address,
  guest_count, meal_type,
  budget_per_person,
  drinks_included, drinks_details,
  service_waitstaff, service_equipment, service_decoration,
  dietary_vegetarian, dietary_gluten_free, dietary_kosher,
  status, description
) values (
  'aaaaaaaa-0004-0004-0004-000000000004',
  'Dîner de gala annuel',
  'c025d0c8-9f18-4d02-85ce-fa59c2f88e9d', '039d57ae-4ea5-4ba6-8992-d642d05cb08c',
  current_date + 60, '19:30', '23:30', '172 boulevard Saint-Germain, Paris 75006',
  90, 'diner',
  55,
  true, 'Champagne à l''accueil, vins accordés, digestifs, eau',
  true, true, true,
  true, true, true,
  'sent_to_caterers',
  'Gala annuel de notre groupe. Événement très important, nous attendons des partenaires et clients stratégiques. Présentation irréprochable exigée. Nous avons des convives végétariens, sans gluten et casher — merci de prévoir des menus individuels identifiés.'
);
insert into quote_request_caterers (quote_request_id, caterer_id, status, responded_at)
values ('aaaaaaaa-0004-0004-0004-000000000004', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2', 'transmitted_to_client', now() - interval '5 days');
insert into quotes (quote_request_id, caterer_id, reference, total_amount_ht, details, status, valid_until, notes)
values (
  'aaaaaaaa-0004-0004-0004-000000000004', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2',
  'DEVIS-2026-002', 4455.00,
  '[{"section":"main","label":"Menu gastronomique 4 services","quantity":90,"unit_price_ht":42,"tva_rate":10,"description":"Entrée, poisson, viande, dessert — déclinaison végétarienne, sans gluten et casher"},{"section":"drinks","label":"Champagne & vins accordés","quantity":90,"unit_price_ht":12,"tva_rate":10,"description":"Champagne à l''accueil, vins blancs et rouges, digestifs"},{"section":"extra","label":"Service en salle (4 serveurs)","quantity":1,"unit_price_ht":720,"tva_rate":20,"description":"Personnel qualifié tenue soirée"},{"section":"extra","label":"Location vaisselle prestige","quantity":1,"unit_price_ht":480,"tva_rate":20,"description":"Couverts dorés, verres en cristal"}]'::jsonb,
  'accepted', current_date + 10,
  'Acompte de 40% à la validation du devis. Solde 48h avant l''événement. Frais de déplacement inclus pour la région parisienne.'
);

-- ── Archivée — SNCF Lyon ─────────────────────────────────────
insert into quote_requests (
  id, title, client_user_id, company_id,
  event_date, event_address,
  guest_count, meal_type,
  budget_global,
  drinks_included,
  service_other,
  dietary_vegan,
  status, description
) values (
  'aaaaaaaa-0005-0005-0005-000000000005',
  'Repas plateau équipes terrain',
  'c025d0c8-9f18-4d02-85ce-fa59c2f88e9d', '9a987402-97e8-4200-a79b-5b5a8e2922c2',
  current_date + 7, 'Dépôt SNCF, 45 rue Bony, Lyon 69009',
  15, 'autre',
  400,
  false,
  'Livraison sur site obligatoire avec conditionnement individuel',
  true,
  'sent_to_caterers',
  'Plateaux repas pour nos équipes en intervention terrain. Livraison sur site indispensable, conditionnement individuel. Au moins 2 options vegan.'
);
insert into quote_request_caterers (quote_request_id, caterer_id, status)
values ('aaaaaaaa-0005-0005-0005-000000000005', '9fab9fa6-409b-4d35-ab67-4a26b42d36b2', 'rejected');
