CREATE TABLE "dining_event_memory_shares" (
    "id" SERIAL NOT NULL,
    "dining_event_id" INTEGER NOT NULL,
    "dining_group_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "snapshot_version" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "plan_date" DATE,
    "meal_slot" "MealSlot",
    "menu_items_snapshot" JSONB NOT NULL,
    "participants_snapshot" JSONB NOT NULL,
    "caption" VARCHAR(120),
    "show_participants" BOOLEAN NOT NULL DEFAULT true,
    "share_token_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_event_memory_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_event_memory_shares_share_token_hash_key" ON "dining_event_memory_shares"("share_token_hash");
CREATE UNIQUE INDEX "dining_event_memory_shares_dining_event_id_snapshot_version_key" ON "dining_event_memory_shares"("dining_event_id", "snapshot_version");
CREATE INDEX "dining_event_memory_shares_created_by_user_id_created_at_idx" ON "dining_event_memory_shares"("created_by_user_id", "created_at");
CREATE INDEX "dining_event_memory_shares_dining_group_id_created_at_idx" ON "dining_event_memory_shares"("dining_group_id", "created_at");

ALTER TABLE "dining_event_memory_shares"
ADD CONSTRAINT "dining_event_memory_shares_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_memory_shares"
ADD CONSTRAINT "dining_event_memory_shares_dining_group_id_fkey"
FOREIGN KEY ("dining_group_id") REFERENCES "dining_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dining_event_memory_shares"
ADD CONSTRAINT "dining_event_memory_shares_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
