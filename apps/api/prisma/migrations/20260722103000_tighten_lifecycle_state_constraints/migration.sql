ALTER TABLE "dining_group_invites"
  DROP CONSTRAINT "ck_dining_group_invites_state",
  ADD CONSTRAINT "ck_dining_group_invites_state" CHECK (
    (
      "status" = 'ACCEPTED'
      AND "accepted_by_user_id" IS NOT NULL
      AND "accepted_at" IS NOT NULL
      AND "revoked_at" IS NULL
    )
    OR (
      "status" = 'REVOKED'
      AND "accepted_by_user_id" IS NULL
      AND "accepted_at" IS NULL
      AND "revoked_at" IS NOT NULL
    )
    OR (
      "status" IN ('PENDING', 'DECLINED', 'EXPIRED')
      AND "accepted_by_user_id" IS NULL
      AND "accepted_at" IS NULL
      AND "revoked_at" IS NULL
    )
  );

ALTER TABLE "carry_back_snapshots"
  DROP CONSTRAINT "ck_carry_back_snapshots_state",
  ADD CONSTRAINT "ck_carry_back_snapshots_state" CHECK (
    (
      "status" = 'DELETED'
      AND "deleted_at" IS NOT NULL
      AND "invalidated_at" IS NULL
    )
    OR (
      "status" = 'INVALIDATED'
      AND "deleted_at" IS NULL
      AND "invalidated_at" IS NOT NULL
    )
    OR (
      "status" IN ('AVAILABLE', 'EXPIRED')
      AND "deleted_at" IS NULL
      AND "invalidated_at" IS NULL
    )
  );
