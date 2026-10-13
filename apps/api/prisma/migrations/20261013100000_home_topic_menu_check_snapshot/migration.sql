CREATE TABLE "home_topic_menu_check_snapshots" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "topic_version" INTEGER NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "home_topic_menu_check_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "home_topic_menu_check_snapshots_topic_id_key"
    ON "home_topic_menu_check_snapshots"("topic_id");

ALTER TABLE "home_topic_menu_check_snapshots"
    ADD CONSTRAINT "home_topic_menu_check_snapshots_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "home_topics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
