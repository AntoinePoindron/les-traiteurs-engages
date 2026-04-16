-- ================================================================
-- Migration 014 : Services internes entreprise, effectifs, dépenses
-- ================================================================

-- ── Tables ──────────────────────────────────────────────────────

-- Services / départements au sein d'une entreprise cliente
CREATE TABLE IF NOT EXISTS company_services (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name          text NOT NULL,
  description   text,
  annual_budget numeric(12,2) DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Effectifs : collaborateurs rattachés à un service (pas forcément des users de la plateforme)
CREATE TABLE IF NOT EXISTS company_employees (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES company_services(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  email      text,
  position   text,
  created_at timestamptz DEFAULT now()
);

-- Attribution d'une demande de devis à un service (pour le suivi des dépenses)
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS company_service_id uuid REFERENCES company_services(id) ON DELETE SET NULL;

-- ── RLS ─────────────────────────────────────────────────────────

ALTER TABLE company_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

-- company_services : lecture + écriture pour les membres de l'entreprise
CREATE POLICY "cs_select" ON company_services
  FOR SELECT USING (auth_company_id() = company_id);
CREATE POLICY "cs_insert" ON company_services
  FOR INSERT WITH CHECK (auth_company_id() = company_id);
CREATE POLICY "cs_update" ON company_services
  FOR UPDATE USING (auth_company_id() = company_id);
CREATE POLICY "cs_delete" ON company_services
  FOR DELETE USING (auth_company_id() = company_id);

-- company_employees : lecture + écriture pour les membres de l'entreprise
CREATE POLICY "ce_select" ON company_employees
  FOR SELECT USING (auth_company_id() = company_id);
CREATE POLICY "ce_insert" ON company_employees
  FOR INSERT WITH CHECK (auth_company_id() = company_id);
CREATE POLICY "ce_update" ON company_employees
  FOR UPDATE USING (auth_company_id() = company_id);
CREATE POLICY "ce_delete" ON company_employees
  FOR DELETE USING (auth_company_id() = company_id);
