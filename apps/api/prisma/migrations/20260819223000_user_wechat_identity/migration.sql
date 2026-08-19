ALTER TABLE "users"
ADD COLUMN "openid" VARCHAR(128),
ADD COLUMN "unionid" VARCHAR(128);

CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");
