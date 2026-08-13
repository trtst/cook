ALTER TYPE "UnitType" RENAME TO "UnitType_old";

CREATE TYPE "UnitType" AS ENUM ('WEIGHT', 'VOLUME', 'COMMON', 'PACKAGE');

ALTER TABLE "units"
  ALTER COLUMN "type" TYPE "UnitType"
  USING (
    CASE
      WHEN "type"::text IN ('COUNT', 'SHAPE', 'CONTAINER', 'OTHER') THEN 'COMMON'
      ELSE "type"::text
    END
  )::"UnitType";

ALTER TABLE "unit_recommendations"
  ALTER COLUMN "unit_type" TYPE "UnitType"
  USING (
    CASE
      WHEN "unit_type"::text IN ('COUNT', 'SHAPE', 'CONTAINER', 'OTHER') THEN 'COMMON'
      ELSE "unit_type"::text
    END
  )::"UnitType";

DROP TYPE "UnitType_old";
