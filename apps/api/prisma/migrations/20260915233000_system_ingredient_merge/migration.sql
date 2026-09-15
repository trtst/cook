DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ingredients" AS source
    LEFT JOIN "ingredients" AS target
      ON target."id" = source."merged_to_id"
    WHERE
      ((source."status" = 'MERGED') <> (source."merged_to_id" IS NOT NULL))
      OR source."merged_to_id" = source."id"
      OR (
        source."status" = 'MERGED'
        AND (
          target."id" IS NULL
          OR target."owner_id" IS NOT NULL
          OR target."status" <> 'ACTIVE'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Invalid ingredient merge relationship';
  END IF;
END $$;

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_merge_state_check"
  CHECK (("status" = 'MERGED') = ("merged_to_id" IS NOT NULL)),
  ADD CONSTRAINT "ingredients_merge_not_self_check"
  CHECK ("merged_to_id" IS NULL OR "merged_to_id" <> "id");
