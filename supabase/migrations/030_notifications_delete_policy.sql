-- ============================================================
-- Migration 030 : RLS DELETE policy sur notifications
-- ============================================================
-- Contexte : le centre de notifs supprime une notif au clic (ou
-- lorsqu'elle est "dismissée" contextuellement quand l'user visite
-- la page cible). Jusqu'ici le DELETE était silently bloqué par RLS
-- parce qu'aucune policy DELETE n'existait — seul SELECT, UPDATE et
-- INSERT (service_role) étaient définis dans 002_rls_policies.sql.
--
-- On autorise un user à supprimer ses propres notifs. Les dismissals
-- côté server (lib/notifications.ts → dismissNotifications) passent
-- déjà par le service-role et ne dépendent pas de cette policy —
-- mais le client-side delete en a besoin.

create policy "notifications_delete" on notifications for delete
  using (user_id = auth.uid());
