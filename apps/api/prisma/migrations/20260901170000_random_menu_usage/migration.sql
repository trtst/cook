CREATE TABLE "random_menu_usages" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,
    "window_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "random_menu_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "random_menu_usages_user_id_key" ON "random_menu_usages"("user_id");
CREATE INDEX "random_menu_usages_user_id_window_ends_at_idx" ON "random_menu_usages"("user_id", "window_ends_at");

ALTER TABLE "random_menu_usages"
    ADD CONSTRAINT "random_menu_usages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
