ALTER TABLE "audit_events"
  DROP CONSTRAINT "audit_events_actor_user_id_fkey",
  DROP CONSTRAINT "audit_events_actor_admin_id_fkey";

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_events_actor_admin_id_fkey"
    FOREIGN KEY ("actor_admin_id") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
