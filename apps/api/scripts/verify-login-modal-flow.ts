import { loadLocalEnv } from "../src/common/load-env";
import type {
  AuthSessionResult,
  AppConfigResponse,
  MeResponse,
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const ownerPassword = process.env.TEST_USER_PASSWORD ?? "change-me";
const deviceId = process.env.TEST_DEVICE_ID ?? `verify-login-modal-${process.pid}`;
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9s8AAAAASUVORK5CYII=",
  "base64"
);

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function buildHeaders(admin = false, extra: Record<string, string> = {}, includeJsonContentType = true) {
  return admin
    ? {
        ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
        "x-cook-from": "admin_web",
        "x-admin-version": "0.1.0",
        "x-admin-build": "1",
        ...extra
      }
    : {
        ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
        "x-cook-from": "mini_program",
        "x-cook-version": "0.1.0",
        ...extra
      };
}

async function request<T>(path: string, options: RequestInit = {}, admin = false) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: buildHeaders(admin, options.headers as Record<string, string> | undefined)
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, admin = false) {
  const result = await request<T>(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function fetchBinary(url: string) {
  const response = await fetch(url);
  assert(response.ok, `fetch asset failed: ${url} -> ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadLoginImage(adminToken: string, image: Buffer) {
  const formData = new FormData();
  formData.append("file", new Blob([image], { type: "image/png" }), "login-modal-test.png");

  const response = await fetch(`${apiBaseUrl}/admin/app-config/login-image`, {
    method: "POST",
    headers: buildHeaders(
      true,
      {
        authorization: `Bearer ${adminToken}`,
        "Idempotency-Key": nextIdempotencyKey()
      },
      false
    ),
    body: formData
  });
  const body = (await response.json()) as ApiEnvelope<AppConfigResponse>;
  assert(response.status >= 200 && response.status < 300, `/admin/app-config/login-image HTTP ${response.status}: ${body.message}`);
  assert(body.code === 0, `/admin/app-config/login-image code ${body.code}: ${body.message}`);
  return body.data;
}

async function clearLoginImage(adminToken: string) {
  return requestData<AppConfigResponse>(
    "/admin/app-config/login-image",
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "Idempotency-Key": nextIdempotencyKey()
      }
    },
    true
  );
}

async function loginAdmin() {
  return requestData<AdminLoginResult>(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword
      })
    },
    true
  );
}

async function main() {
  const publicConfigBefore = await requestData<AppConfigResponse>("/app-config");
  const adminSession = await loginAdmin();
  const adminConfigBefore = await requestData<AppConfigResponse>(
    "/admin/app-config",
    {
      headers: {
        authorization: `Bearer ${adminSession.token}`
      }
    },
    true
  );
  const originalImageBytes =
    publicConfigBefore.login.imageUrl && /^https?:\/\//.test(publicConfigBefore.login.imageUrl)
      ? await fetchBinary(publicConfigBefore.login.imageUrl)
      : null;

  let uploaded = false;

  try {
    const session = await requestData<AuthSessionResult>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({
        phone: ownerPhone,
        password: ownerPassword,
        deviceId
      })
    });
    assert(session.accessToken, "password login access token missing");
    assert(session.refreshToken, "password login refresh token missing");
    assert(session.user.uid > 0, "password login uid missing");

    const me = await requestData<MeResponse>("/users/me", {
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });
    assert(me.profile, "users/me profile missing");

    const uploadedConfig = await uploadLoginImage(adminSession.token, pngBytes);
    uploaded = true;
    assert(uploadedConfig.login.imageUrl, "uploaded login image url missing");
    assert(
      /\/(?:static\/uploads|uploads)\/admin\/login-image\/login-image\./.test(uploadedConfig.login.imageUrl),
      `uploaded login image url mismatch: ${uploadedConfig.login.imageUrl}`
    );
    await fetchBinary(uploadedConfig.login.imageUrl);

    const publicConfigAfterUpload = await requestData<AppConfigResponse>("/app-config");
    assert(publicConfigAfterUpload.login.imageUrl, "public config login image should be readable after upload");
    await fetchBinary(publicConfigAfterUpload.login.imageUrl);

    const clearedConfig = await clearLoginImage(adminSession.token);
    uploaded = false;
    assert(clearedConfig.login.imageUrl === null, "cleared login image should be null");

    const publicConfigAfterClear = await requestData<AppConfigResponse>("/app-config");
    assert(publicConfigAfterClear.login.imageUrl === null, "public config should clear login image");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          passwordLoginUid: session.user.uid,
          adminConfigBeforeImage: adminConfigBefore.login.imageUrl,
          publicConfigBeforeImage: publicConfigBefore.login.imageUrl,
          uploadedImageUrl: publicConfigAfterUpload.login.imageUrl,
          clearedImageUrl: publicConfigAfterClear.login.imageUrl
        },
        null,
        2
      )
    );
  } finally {
    if (originalImageBytes) {
      await uploadLoginImage(adminSession.token, originalImageBytes);
      return;
    }

    if (uploaded || adminConfigBefore.login.imageUrl) {
      await clearLoginImage(adminSession.token);
    }
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
