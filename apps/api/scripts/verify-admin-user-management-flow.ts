import type {
  AdminResetUserPasswordResponse,
  PageResult,
  AuthSessionResult,
  UserProfile
} from "../src/contracts/types";
import { maskPhone } from "../src/common/phone";
import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
  admin: { id: number; username: string };
}

let idempotencySeed = Date.now();

const adminHeaders = {
  "content-type": "application/json",
  "x-cook-from": "admin_web",
  "x-admin-version": "0.1.0",
  "x-admin-build": "1"
};

const userHeaders = {
  "content-type": "application/json",
  "x-cook-from": "mp-weixin",
  "x-cook-version": "0.1.0",
  "x-cook-build": "1"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

async function request<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = adminHeaders) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = adminHeaders) {
  const result = await request<T>(path, options, headers);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function main() {
  const suffix = `${Date.now()}`.slice(-8);
  const createdPhone = `139${suffix}`;
  const updatedPhone = `138${suffix}`;
  const initialPassword = "change-me";
  const resetPassword = "change-me-2";

  const login = await requestData<AdminLoginResult>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  });
  const authorization = `Bearer ${login.token}`;

  const created = await requestData<UserProfile>(
    "/admin/users",
    {
      method: "POST",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        phone: createdPhone,
        password: initialPassword,
        nickname: "后台新增用户"
      })
    }
  );
  const userRequestData = <T>(path: string, options: RequestInit = {}) => requestData<T>(path, options, userHeaders);
  assert(created.phone === maskPhone(createdPhone), "created phone mismatch");
  assert(created.status === "ACTIVE", "created user should be active");

  const updated = await requestData<UserProfile>(
    `/admin/users/${created.id}`,
    {
      method: "PUT",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        phone: updatedPhone,
        nickname: "后台已编辑用户"
      })
    }
  );
  assert(updated.phone === maskPhone(updatedPhone), "updated phone mismatch");
  assert(updated.nickname === "后台已编辑用户", "updated nickname mismatch");

  const revealedPhone = await requestData<{ phone: string | null }>(
    `/admin/users/${created.id}/phone/reveal`,
    {
      method: "POST",
      headers: { authorization }
    }
  );
  assert(revealedPhone.phone === updatedPhone, "revealed phone should return the full updated phone");

  const initialLogin = await loginWithPassword(userRequestData, updatedPhone, initialPassword);

  const cleared = await requestData<UserProfile>(
    `/admin/users/${created.id}`,
    {
      method: "PUT",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        nickname: ""
      })
    }
  );
  assert(cleared.nickname === null, "cleared nickname should be null");

  const reset = await requestData<AdminResetUserPasswordResponse>(
    `/admin/users/${created.id}/reset-password`,
    {
      method: "POST",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        newPassword: resetPassword
      })
    }
  );
  assert(reset.userId === created.id, "reset user mismatch");

  const resetOldToken = await request<UserProfile>("/users/me", {
    headers: { authorization: `Bearer ${initialLogin.token}` }
  }, userHeaders);
  assert(resetOldToken.status === 200 && resetOldToken.body.code === 401, "reset password should invalidate existing token");

  const resetLogin = await loginWithPassword(userRequestData, updatedPhone, resetPassword);

  const disabled = await requestData<UserProfile>(
    `/admin/users/${created.id}/status`,
    {
      method: "POST",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        status: "DISABLED"
      })
    }
  );
  assert(disabled.status === "DISABLED", "user should be disabled");

  const disabledOldToken = await request<UserProfile>("/users/me", {
    headers: { authorization: `Bearer ${resetLogin.token}` }
  }, userHeaders);
  assert(disabledOldToken.status === 200 && disabledOldToken.body.code === 401, "disabled user existing token should return business code 401");

  const disabledLogin = await request<AuthSessionResult>(
    "/auth/password/login",
    {
      method: "POST",
      body: JSON.stringify({
        phone: updatedPhone,
        password: resetPassword,
        deviceId: `admin-user-management-disabled-${nextIdempotencyKey()}`
      })
    },
    userHeaders
  );
  assert(disabledLogin.status === 200 && disabledLogin.body.code === 401, "disabled user login should return business code 401");

  const enabled = await requestData<UserProfile>(
    `/admin/users/${created.id}/status`,
    {
      method: "POST",
      headers: withIdempotencyKey({ authorization }),
      body: JSON.stringify({
        status: "ACTIVE"
      })
    }
  );
  assert(enabled.status === "ACTIVE", "user should be enabled");

  const userLogin = await loginWithPassword(userRequestData, updatedPhone, resetPassword);
  assert(userLogin.user.uid === created.uid, "reset password login uid mismatch");

  const users = await requestData<PageResult<UserProfile>>(`/admin/users?page=1&pageSize=20&keyword=${updatedPhone}`, {
    headers: { authorization }
  });
  assert(users.items.some(item => item.id === created.id), "managed user should appear in admin users search");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        createdUserId: created.id,
        createdPhone,
        updatedPhone,
        revealedPhoneOk: revealedPhone.phone === updatedPhone,
        managedUserUid: created.uid,
        disabledLoginStatus: disabledLogin.status,
        resetOldTokenStatus: resetOldToken.status,
        disabledOldTokenStatus: disabledOldToken.status,
        usersFound: users.items.length
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
