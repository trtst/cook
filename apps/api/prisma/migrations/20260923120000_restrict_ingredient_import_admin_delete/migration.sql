ALTER TABLE "ingredient_import_jobs"
  DROP CONSTRAINT "ingredient_import_jobs_created_by_admin_id_fkey";

ALTER TABLE "ingredient_import_jobs"
  ADD CONSTRAINT "ingredient_import_jobs_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
