-- ================================================================
-- Migration 015 : Permettre aux clients d'accepter/refuser des devis
--                 et de créer des commandes
-- ================================================================

-- ── quotes : les clients peuvent passer un devis en accepted/refused ──

CREATE POLICY "quotes_update_client" ON quotes
  FOR UPDATE
  USING (
    auth_role() IN ('client_user', 'client_admin')
    AND status IN ('sent', 'accepted', 'refused')
    AND EXISTS (
      SELECT 1 FROM quote_requests qr
      WHERE qr.id = quote_request_id
        AND (
          qr.client_user_id = auth.uid()
          OR (auth_role() = 'client_admin' AND qr.company_id = auth_company_id())
        )
    )
  )
  WITH CHECK (
    status IN ('accepted', 'refused')
  );

-- ── quote_requests : les clients peuvent clôturer leur demande ───────

CREATE POLICY "quote_requests_update_complete" ON quote_requests
  FOR UPDATE
  USING (
    auth_role() IN ('client_user', 'client_admin')
    AND (
      client_user_id = auth.uid()
      OR (auth_role() = 'client_admin' AND company_id = auth_company_id())
    )
    AND status IN ('sent_to_caterers', 'approved')
  )
  WITH CHECK (
    status = 'completed'
  );

-- ── orders : les client_user peuvent aussi créer des commandes ───────

CREATE POLICY "orders_insert_client_user" ON orders
  FOR INSERT
  WITH CHECK (
    auth_role() = 'client_user'
    AND client_admin_id = auth.uid()
  );

-- ── invoices : le créateur de la commande peut voir sa facture ───────

CREATE POLICY "invoices_select_order_owner" ON invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.client_admin_id = auth.uid()
    )
  );
