-- Add the server-owned authentication facts without changing existing user rows.

CREATE TYPE "AuthCodeScene" AS ENUM ('LOGIN');

CREATE TABLE "user_wechat_identities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "appid" VARCHAR(64) NOT NULL,
    "openid" VARCHAR(128) NOT NULL,
    "unionid" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_wechat_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(128) NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wechat_login_sessions" (
    "id" SERIAL NOT NULL,
    "appid" VARCHAR(64) NOT NULL,
    "openid" VARCHAR(128) NOT NULL,
    "unionid" VARCHAR(128),
    "session_key_hash" VARCHAR(128) NOT NULL,
    "wechat_session_id_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wechat_login_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_codes" (
    "id" SERIAL NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "scene" "AuthCodeScene" NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip" VARCHAR(64) NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_risk_events" (
    "id" SERIAL NOT NULL,
    "scene" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(32),
    "openid" VARCHAR(128),
    "ip" VARCHAR(64) NOT NULL,
    "device_id" VARCHAR(128) NOT NULL,
    "decision" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_risk_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_wechat_identities_appid_openid_key" ON "user_wechat_identities"("appid", "openid");
CREATE UNIQUE INDEX "user_wechat_identities_user_id_appid_key" ON "user_wechat_identities"("user_id", "appid");
CREATE INDEX "user_wechat_identities_user_id_created_at_idx" ON "user_wechat_identities"("user_id", "created_at");

CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE INDEX "auth_sessions_user_id_revoked_at_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "expires_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

CREATE UNIQUE INDEX "wechat_login_sessions_wechat_session_id_hash_key" ON "wechat_login_sessions"("wechat_session_id_hash");
CREATE INDEX "wechat_login_sessions_appid_openid_expires_at_idx" ON "wechat_login_sessions"("appid", "openid", "expires_at");
CREATE INDEX "wechat_login_sessions_expires_at_idx" ON "wechat_login_sessions"("expires_at");

CREATE INDEX "sms_codes_phone_scene_created_at_idx" ON "sms_codes"("phone", "scene", "created_at");
CREATE INDEX "sms_codes_ip_created_at_idx" ON "sms_codes"("ip", "created_at");
CREATE INDEX "sms_codes_device_id_created_at_idx" ON "sms_codes"("device_id", "created_at");

CREATE INDEX "auth_risk_events_phone_created_at_idx" ON "auth_risk_events"("phone", "created_at");
CREATE INDEX "auth_risk_events_openid_created_at_idx" ON "auth_risk_events"("openid", "created_at");
CREATE INDEX "auth_risk_events_ip_created_at_idx" ON "auth_risk_events"("ip", "created_at");
CREATE INDEX "auth_risk_events_device_id_created_at_idx" ON "auth_risk_events"("device_id", "created_at");

ALTER TABLE "user_wechat_identities" ADD CONSTRAINT "user_wechat_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
