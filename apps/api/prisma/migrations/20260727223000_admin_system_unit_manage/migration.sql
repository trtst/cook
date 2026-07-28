-- AlterEnum
ALTER TYPE "UnitType" ADD VALUE 'SHAPE';

-- CreateIndex
CREATE UNIQUE INDEX "units_system_search_key_key"
ON "units"("search_key")
WHERE "owner_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "units_owner_id_search_key_key"
ON "units"("owner_id", "search_key")
WHERE "owner_id" IS NOT NULL;
