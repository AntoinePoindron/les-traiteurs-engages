-- ================================================================
-- Migration 026 : préfixe de numérotation par traiteur + unicité
--                des références de devis
-- ================================================================
-- Contexte : les factures Stripe sont émises avec un `number` custom
-- dérivé de la référence du devis (DEVIS-… → FAC-…). Stripe impose
-- l'unicité du `number` au niveau du compte, donc deux traiteurs ne
-- peuvent pas générer tous les deux un DEVIS-2026-015 sans faire
-- échouer le second passage à "livrée".
--
-- Solution en deux couches :
--   1. `caterers.invoice_prefix` (ex. ACME, 1001S, LESAV) : inclus
--      dans la ref par défaut → DEVIS-ACME-2026-015. Garantit
--      l'unicité cross-caterer.
--   2. Unique index sur `(caterer_id, reference)` : empêche un même
--      traiteur de créer deux devis avec la même ref (filet de
--      sécurité côté DB en plus de la validation applicative dans
--      saveQuote).
--
-- Idempotence : la migration utilise `if not exists` / DO blocks
-- partout pour pouvoir être re-exécutée sans erreur, et intègre
-- une déduplication préventive des refs existantes avant de poser
-- le unique index sur quotes.
-- ================================================================

-- ── 1. Colonne invoice_prefix sur caterers ────────────────────────
alter table caterers
  add column if not exists invoice_prefix text;

-- Backfill "smart" : essaie 5 chars, puis 8, puis 10 avant de retomber
-- sur un suffixe numérique. Permet à deux traiteurs au nom similaire
-- d'avoir des préfixes distingués par des caractères significatifs
-- du nom plutôt qu'un simple "1", "2"…
--
-- Exemple :
--   "Saveurs d'ailleurs"  → SAVEU     (libre)
--   "Saveurs inclusives"  → SAVEURSI  (SAVEU pris, tente 8 chars)
--   "Saveurs de Bretagne" → SAVEURSDE (SAVEURSI pris, tente 10 chars)
--   "Saveurs"             → SAVEU1    (SAVEU pris et seulement 7 lettres
--                                     → numérique)
--
-- Les noms vides / sans caractère ASCII reçoivent "C" + 4 chars de l'id.
do $$
declare
  cat record;
  normalized text;
  base5 text;
  base8 text;
  base10 text;
  candidate text;
  counter int;
begin
  for cat in
    select id, name, created_at
    from caterers
    where invoice_prefix is null
    order by created_at, id
  loop
    normalized := regexp_replace(coalesce(cat.name, ''), '[^A-Za-z0-9]', '', 'g');
    base5      := upper(substring(normalized, 1, 5));
    base8      := upper(substring(normalized, 1, 8));
    base10     := upper(substring(normalized, 1, 10));

    if base5 = '' then
      candidate := 'C' || upper(substring(cat.id::text, 1, 4));
    else
      -- Essai 1 : 5 chars
      candidate := base5;

      -- Essai 2 : 8 chars (si vraiment plus long)
      if exists (select 1 from caterers where invoice_prefix = candidate)
         and length(base8) > length(base5) then
        candidate := base8;
      end if;

      -- Essai 3 : 10 chars
      if exists (select 1 from caterers where invoice_prefix = candidate)
         and length(base10) > length(candidate) then
        candidate := base10;
      end if;

      -- Fallback numérique à partir du slug 5 chars (max 99 variantes)
      counter := 1;
      while exists (select 1 from caterers where invoice_prefix = candidate)
            and counter < 100
      loop
        candidate := base5 || counter::text;
        counter := counter + 1;
      end loop;
    end if;

    update caterers set invoice_prefix = candidate where id = cat.id;
  end loop;
end $$;

-- NOT NULL (no-op si déjà appliqué)
alter table caterers
  alter column invoice_prefix set not null;

-- Nettoyage d'une éventuelle contrainte créée par une première tentative
-- de cette migration (avant qu'on passe à un index — les constraints
-- n'ont pas de IF NOT EXISTS). Drop seulement si elle existe.
alter table caterers drop constraint if exists caterers_invoice_prefix_unique;

-- Unique via index (idempotent grâce à IF NOT EXISTS).
create unique index if not exists caterers_invoice_prefix_unique_idx
  on caterers(invoice_prefix);

-- ── 2. Déduplication des références de devis existantes ──────────
-- Avant de poser le unique index sur (caterer_id, reference), on
-- disambigue les doublons déjà présents. Le plus ancien (par
-- created_at) garde sa ref intacte ; les suivants reçoivent un
-- suffixe -DUP2, -DUP3… Les devis concernés seront à renommer
-- manuellement ou à supprimer s'il s'agit de données de test.
with dups as (
  select
    id,
    row_number() over (
      partition by caterer_id, reference
      order by created_at, id
    ) as rn
  from quotes
  where reference is not null
)
update quotes q
set reference = q.reference || '-DUP' || d.rn::text
from dups d
where q.id = d.id
  and d.rn > 1;

-- ── 3. Unique index (caterer_id, reference) ──────────────────────
create unique index if not exists quotes_caterer_reference_unique
  on quotes(caterer_id, reference)
  where reference is not null;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
