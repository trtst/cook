-- Establish the fixed non-login identity before application code starts writing system recipes.
-- Existing recipe ownership and the legacy calorie column are intentionally left untouched
-- until the data migration is explicitly approved and run against a backed-up database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    WHERE "uid" = 10001
      AND ("phone" IS NOT NULL OR "openid" IS NOT NULL OR "password_hash" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'UID 10001 已绑定登录身份，不能作为系统用户';
  END IF;
END $$;

INSERT INTO "users" (
  "uid",
  "nickname",
  "status",
  "session_version",
  "created_at",
  "updated_at"
)
VALUES (10001, '系统菜谱', 'ACTIVE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("uid") DO NOTHING;
