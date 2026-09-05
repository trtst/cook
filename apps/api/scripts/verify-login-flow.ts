import { PrismaClient, type UserStatus } from "@prisma/client";
import { maskPhone } from "../src/common/phone";
import type { AuthSessionResult, MeResponse } from "../src/contracts/types";
import { loadLocalEnv } from "../src/common/load-env";
import { APP_NAME } from "../src/config/app";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const deviceId = process.env.TEST_DEVICE_ID ?? `verify-login-${process.pid}`;

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
    select: {
      id: true,
      uid: true,
      nickname: true,
      avatarUrl: true,
      phone: true,
      status: true
    }
  });
  const originalNickname = seededUser.nickname;
  const originalAvatarUrl = seededUser.avatarUrl;
  const originalStatus = seededUser.status;

  try {
    const unauthenticatedMe = await request<MeResponse>("/users/me");
    assert(unauthenticatedMe.status === 200 && unauthenticatedMe.body.code === 401, "unauthenticated GET /users/me should return business code 401");

    const login = await requestData<AuthSessionResult>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ phone: ownerPhone, password, deviceId })
    });
    assert(login.user.uid === seededUser.uid, "login user uid mismatch");
    assert(!("phone" in login.user), "login response should not expose phone");

    const authorization = `Bearer ${login.accessToken}`;
    const meAfterLogin = await requestData<MeResponse>("/users/me", {
      headers: { authorization }
    });
    assert(meAfterLogin.profile, "GET /users/me profile missing");

    const nickname = `${APP_NAME}用户-${Date.now()}`;
    const oldFieldUpdate = await request<null>("/users/me/profile", {
      method: "PUT",
      headers: { authorization },
      body: JSON.stringify({
        nickname,
        avatarUrl: "https://example.com/avatar.png",
        phone: "13700000000"
      })
    });
    assert(oldFieldUpdate.status === 200 && oldFieldUpdate.body.code === 400, "old phone field should return business code 400");

    const updatedProfile = await requestData<null>("/users/me/profile", {
      method: "PUT",
      headers: { authorization },
      body: JSON.stringify({
        nickname
      })
    });
    assert(updatedProfile === null, "profile update should return null data");
    const updatedUser = await requestData<MeResponse>("/users/me", {
      headers: { authorization }
    });
    assert(updatedUser.profile, "updated profile missing");
    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: { id: seededUser.id },
      select: { nickname: true, phone: true }
    });
    assert(persistedUser.nickname === nickname, "nickname update failed");
    assert(persistedUser.phone === ownerPhone, "phone should not be changed by profile update");

    const refreshed = await requestData<AuthSessionResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: login.refreshToken, deviceId })
    });
    assert(refreshed.accessToken, "refreshed access token missing");
    assert(refreshed.refreshToken, "refreshed refresh token missing");
    assert(refreshed.accessExpiresAt, "refreshed access expiry missing");

    const refreshedAuthorization = `Bearer ${refreshed.accessToken}`;
    const meAfterRefresh = await requestData<MeResponse>("/users/me", {
      headers: { authorization: refreshedAuthorization }
    });
    assert(meAfterRefresh.profile, "refreshed session did not read the updated profile");

    await prisma.user.update({
      where: { id: seededUser.id },
      data: { status: "DISABLED" }
    });

    const disabledRefresh = await request<AuthSessionResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshed.refreshToken, deviceId })
    });
    assert(disabledRefresh.status === 200 && disabledRefresh.body.code === 401, "disabled user refresh should return business code 401");

    const disabledMe = await request<MeResponse>("/users/me", {
      headers: { authorization: refreshedAuthorization }
    });
    assert(disabledMe.status === 200 && disabledMe.body.code === 401, "disabled user GET /users/me should return business code 401");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          loginUid: login.user.uid,
          unauthenticatedMeStatus: unauthenticatedMe.status,
          disabledRefreshStatus: disabledRefresh.status,
          disabledMeStatus: disabledMe.status,
          nicknameUpdated: persistedUser.nickname === nickname,
          oldPhoneFieldStatus: oldFieldUpdate.status,
          phoneMasked: maskPhone(persistedUser.phone)
        },
        null,
        2
      )
    );
  } finally {
    await prisma.user.update({
      where: { id: seededUser.id },
      data: {
        nickname: originalNickname,
        avatarUrl: originalAvatarUrl,
        status: originalStatus as UserStatus
      }
    });
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
