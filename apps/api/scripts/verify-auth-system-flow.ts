import { PrismaClient, type UserStatus } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { maskPhone } from "../src/common/phone";
import type { AuthMeResponse, AuthSessionResult } from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const deviceId = process.env.TEST_DEVICE_ID ?? `verify-auth-system-${process.pid}`;

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

const commonHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mini_program",
  "x-cook-version": "0.1.0"
};

type TrackedSession = { refreshToken: string; deviceId: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...commonHeaders, ...options.headers }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function main() {
  const prisma = new PrismaClient();
  const seededUser = await prisma.user.findFirstOrThrow({
    where: { phone: ownerPhone },
    select: { id: true, uid: true, status: true }
  });
  const originalStatus = seededUser.status;
  const sessions: TrackedSession[] = [];

  try {
    const unauthenticatedAuthMe = await request<AuthMeResponse>("/auth/me");
    assert(unauthenticatedAuthMe.status === 401, "unauthenticated /auth/me should return 401");

    const first = await requestData<AuthSessionResult>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ phone: ownerPhone, password, deviceId })
    });
    sessions.push({ refreshToken: first.refreshToken, deviceId });
    assert(first.user.uid === seededUser.uid, "password login uid mismatch");
    assert(first.accessToken && first.refreshToken, "password login session is incomplete");

    const authMe = await requestData<AuthMeResponse>("/auth/me", {
      headers: { authorization: `Bearer ${first.accessToken}` }
    });
    assert(authMe.id === seededUser.id, "/auth/me id mismatch");
    assert(authMe.phone === maskPhone(ownerPhone), "/auth/me phone should be masked");

    const refreshed = await requestData<AuthSessionResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: first.refreshToken, deviceId })
    });
    sessions.push({ refreshToken: refreshed.refreshToken, deviceId });
    assert(refreshed.refreshToken !== first.refreshToken, "refresh token was not rotated");

    const rotatedReplay = await request<AuthSessionResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: first.refreshToken, deviceId })
    });
    assert(rotatedReplay.status === 401, "rotated refresh token should be rejected");

    const logoutData = await requestData<null>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshed.refreshToken, deviceId })
    });
    assert(logoutData === null, "/auth/logout should return null data");
    const revokedReplay = await request<AuthSessionResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshed.refreshToken, deviceId })
    });
    assert(revokedReplay.status === 401, "logged-out refresh token should be rejected");

    const disabledDeviceId = `${deviceId}-disabled`;
    const second = await requestData<AuthSessionResult>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ phone: ownerPhone, password, deviceId: disabledDeviceId })
    });
    sessions.push({ refreshToken: second.refreshToken, deviceId: disabledDeviceId });

    await prisma.user.update({ where: { id: seededUser.id }, data: { status: "DISABLED" } });
    const disabledLogin = await request<AuthSessionResult>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ phone: ownerPhone, password, deviceId: `${deviceId}-blocked` })
    });
    assert(disabledLogin.status === 401, "disabled user password login should return 401");

    for (const oldPath of ["/auth/login", "/auth/code-send", "/auth/code-login", "/auth/wechat-login"]) {
      const legacy = await request<null>(oldPath, { method: "POST", body: JSON.stringify({}) });
      assert(legacy.status === 404, `${oldPath} should not have a compatibility route`);
    }

    const smsConfigReady = Boolean(
      process.env.SMS_ACCESS_KEY_ID?.trim() &&
        process.env.SMS_ACCESS_KEY_SECRET?.trim() &&
        process.env.SMS_SIGN_NAME?.trim() &&
        process.env.SMS_TEMPLATE_CODE?.trim()
    );
    const wechatConfigReady = Boolean(process.env.WECHAT_APP_ID?.trim() && process.env.WECHAT_APP_SECRET?.trim());

    if (!smsConfigReady) {
      const smsUnavailable = await request<null>("/auth/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone: ownerPhone, scene: "LOGIN", deviceId: `${deviceId}-sms` })
      });
      assert(smsUnavailable.status === 503, "SMS should report missing provider configuration as 503");
    }

    if (wechatConfigReady) {
      const invalidWechat = await request<null>("/auth/wechat/session", {
        method: "POST",
        body: JSON.stringify({ code: `invalid-${process.pid}`, deviceId: `${deviceId}-wechat` })
      });
      assert(invalidWechat.status === 400, "invalid WeChat code should map to 400");
    }

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          passwordLoginUid: first.user.uid,
          authMePhoneMasked: authMe.phone === maskPhone(ownerPhone),
          refreshRotated: refreshed.refreshToken !== first.refreshToken,
          rotatedReplayStatus: rotatedReplay.status,
          revokedReplayStatus: revokedReplay.status,
          disabledLoginStatus: disabledLogin.status,
          legacyRoutesRemoved: true,
          smsProvider: smsConfigReady ? "configured-not-called" : "missing-503-verified",
          wechatProvider: wechatConfigReady ? "configured-invalid-code-400-verified" : "missing-not-called"
        },
        null,
        2
      )
    );
  } finally {
    await prisma.user.update({ where: { id: seededUser.id }, data: { status: originalStatus as UserStatus } });
    for (const session of sessions) {
      await request<null>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.refreshToken, deviceId: session.deviceId })
      }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
