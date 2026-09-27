ALTER TYPE "MedalAwardRule" ADD VALUE IF NOT EXISTS 'SHOPPING_COMPLETION';
ALTER TYPE "MedalAwardRule" ADD VALUE IF NOT EXISTS 'FRIDGE_MAINTENANCE';
ALTER TYPE "MedalAwardRule" ADD VALUE IF NOT EXISTS 'MEMORY_SHARE_STARTED_TOTAL';

CREATE TYPE "FridgeMaintenanceAction" AS ENUM ('ADDED', 'REMOVED');

ALTER TABLE "dining_events"
ADD COLUMN "memory_share_started_at" TIMESTAMPTZ(3);

CREATE INDEX "dining_events_user_id_memory_share_started_at_idx"
ON "dining_events"("user_id", "memory_share_started_at");

CREATE TABLE "fridge_maintenance_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "operation_id" VARCHAR(64) NOT NULL,
    "action" "FridgeMaintenanceAction" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fridge_maintenance_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fridge_maintenance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fridge_maintenance_events_user_id_operation_id_key"
ON "fridge_maintenance_events"("user_id", "operation_id");

CREATE INDEX "fridge_maintenance_events_user_id_created_at_idx"
ON "fridge_maintenance_events"("user_id", "created_at");

CREATE INDEX "shopping_lists_owner_user_id_status_completed_at_idx"
ON "shopping_lists"("owner_user_id", "status", "completed_at");
