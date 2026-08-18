ALTER TABLE "dining_event_participants"
ADD COLUMN "invited_by_user_id" INTEGER;

ALTER TABLE "dining_event_participants"
ADD CONSTRAINT "dining_event_participants_invited_by_user_id_fkey"
FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "dining_event_participants_invited_by_user_id_idx"
ON "dining_event_participants"("invited_by_user_id");

CREATE TYPE "DiningEventShareInviteStatus" AS ENUM ('ACTIVE', 'OPENED', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "dining_event_share_invites" (
  "id" SERIAL NOT NULL,
  "dining_event_id" INTEGER NOT NULL,
  "inviter_user_id" INTEGER NOT NULL,
  "accepted_by_user_id" INTEGER,
  "share_token_hash" VARCHAR(128) NOT NULL,
  "status" "DiningEventShareInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "opened_at" TIMESTAMPTZ(3),
  "validated_at" TIMESTAMPTZ(3),
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "expired_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dining_event_share_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dining_event_share_invites_share_token_hash_key"
ON "dining_event_share_invites"("share_token_hash");

CREATE INDEX "dining_event_share_invites_dining_event_id_created_at_idx"
ON "dining_event_share_invites"("dining_event_id", "created_at" DESC);

CREATE INDEX "dining_event_share_invites_inviter_user_id_created_at_idx"
ON "dining_event_share_invites"("inviter_user_id", "created_at" DESC);

CREATE INDEX "dining_event_share_invites_accepted_by_user_id_created_at_idx"
ON "dining_event_share_invites"("accepted_by_user_id", "created_at" DESC);

ALTER TABLE "dining_event_share_invites"
ADD CONSTRAINT "dining_event_share_invites_dining_event_id_fkey"
FOREIGN KEY ("dining_event_id") REFERENCES "dining_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_share_invites"
ADD CONSTRAINT "dining_event_share_invites_inviter_user_id_fkey"
FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dining_event_share_invites"
ADD CONSTRAINT "dining_event_share_invites_accepted_by_user_id_fkey"
FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
