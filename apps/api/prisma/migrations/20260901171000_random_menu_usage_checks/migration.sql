ALTER TABLE "random_menu_usages"
    ADD CONSTRAINT "random_menu_usages_used_count_check"
    CHECK ("used_count" >= 0);

ALTER TABLE "random_menu_usages"
    ADD CONSTRAINT "random_menu_usages_window_check"
    CHECK ("window_ends_at" > "window_started_at");
