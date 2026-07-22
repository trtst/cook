CREATE INDEX "carry_back_snapshots_user_id_source_dining_group_id_status_idx"
  ON "carry_back_snapshots"("user_id", "source_dining_group_id", "status");

CREATE INDEX "idempotency_records_operation_id_operation_type_user_id_dining_group_id_idx"
  ON "idempotency_records"("operation_id", "operation_type", "user_id", "dining_group_id");
