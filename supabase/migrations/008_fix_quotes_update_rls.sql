-- Fix quotes UPDATE policy.
-- The previous policy had no WITH CHECK clause, so PostgreSQL reused the
-- USING expression ("status = 'draft'") as the WITH CHECK too.
-- That prevented a caterer from flipping a draft to "sent".
-- We now split the two clauses:
--   USING  → only draft rows can be targeted (old row must be draft)
--   WITH CHECK → caterer can leave it as draft OR promote it to sent

drop policy if exists "quotes_update" on quotes;

create policy "quotes_update" on quotes for update
  using (
    auth_role() = 'super_admin'
    or (auth_role() = 'caterer' and caterer_id = auth_caterer_id() and status = 'draft')
  )
  with check (
    auth_role() = 'super_admin'
    or (
      auth_role() = 'caterer'
      and caterer_id = auth_caterer_id()
      and status in ('draft', 'sent')
    )
  );
