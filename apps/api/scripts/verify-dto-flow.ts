import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";

interface ApiEnvelope {
  code: number;
  message: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function post(path: string, body: unknown) {
  const appHeaders = path.startsWith("/admin/")
    ? { "x-cook-from": "admin_web", "x-admin-version": "0.1.0", "x-admin-build": "1" }
    : { "x-cook-from": "mini_program", "x-cook-version": "0.1.0" };
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...appHeaders
    },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: (await response.json()) as ApiEnvelope };
}

async function main() {
  const invalidPhone = await post("/auth/login", { phone: "not-a-phone", password: "change-me" });
  assert(invalidPhone.status === 400 && invalidPhone.body.code === 400, "invalid login field should return 400");

  const oldField = await post("/auth/login", {
    phone: "13800000000",
    password: "change-me",
    currentSpaceId: "old-field"
  });
  assert(oldField.status === 400 && oldField.body.code === 400, "unknown login field should return 400");

  const longAdminName = await post("/admin/auth/login", { username: "a".repeat(65), password: "change-me" });
  assert(longAdminName.status === 400 && longAdminName.body.code === 400, "oversized admin login field should return 400");

  console.log(JSON.stringify({ apiBaseUrl, invalidPhone: 400, oldField: 400, longAdminName: 400 }, null, 2));
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
