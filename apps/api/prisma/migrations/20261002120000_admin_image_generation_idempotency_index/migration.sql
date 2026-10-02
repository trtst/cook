DROP INDEX IF EXISTS "idempotency_records_admin_id_operation_type_idx";
CREATE INDEX "idempotency_records_admin_operation_created_idx"
  ON "idempotency_records"("admin_id", "operation_type", "created_at");
