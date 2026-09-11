-- Stable invitation paths are derived from the invite ID and a server-side signature.
-- The prior one-way token hash cannot be used to reconstruct a share path for the owner.
ALTER TABLE "dining_event_share_invites"
DROP COLUMN "share_token_hash";

-- Keep the newest active invitation before enforcing one active invitation per event.
WITH ranked_active_invites AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "dining_event_id"
           ORDER BY "created_at" DESC, "id" DESC
         ) AS row_number
  FROM "dining_event_share_invites"
  WHERE "status" IN ('ACTIVE', 'OPENED')
)
UPDATE "dining_event_share_invites" AS invite
SET "status" = 'REVOKED',
    "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP),
    "updated_at" = CURRENT_TIMESTAMP
FROM ranked_active_invites AS ranked
WHERE invite."id" = ranked."id"
  AND ranked.row_number > 1;

-- Existing unfinished events gain exactly one active invitation when none remains,
-- so their owner can use the same one-tap share behavior after deployment.
INSERT INTO "dining_event_share_invites" ("dining_event_id", "inviter_user_id", "status", "created_at", "updated_at")
SELECT event."id", event."user_id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "dining_events" AS event
WHERE event."status" NOT IN ('CANCELLED', 'COMPLETED')
  AND NOT EXISTS (
    SELECT 1
    FROM "dining_event_share_invites" AS invite
    WHERE invite."dining_event_id" = event."id"
      AND invite."status" IN ('ACTIVE', 'OPENED')
  );

CREATE UNIQUE INDEX "dining_event_share_invites_one_active_per_event_key"
ON "dining_event_share_invites" ("dining_event_id")
WHERE "status" IN ('ACTIVE', 'OPENED');
