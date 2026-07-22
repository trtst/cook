import { PrismaClient } from "@prisma/client";
import type {
  AdminDiningGroupSummary,
  AdminUserEntitlementResponse,
  PageResult,
  UserProfile
} from "../src/contracts/types";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const guestPhone = process.env.TEST_GUEST_PHONE ?? "13900000000";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
  admin: { id: string; username: string };
}

const adminHeaders = {
  "content-type": "application/json",
  "x-cook-from": "admin_web",
  "x-admin-version": "0.1.0",
  "x-admin-build": "1"
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...adminHeaders, ...options.headers }
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

  try {
    const [ownerUser, guestUser] = await Promise.all([
      prisma.user.findFirstOrThrow({
        where: { phone: ownerPhone },
        select: { id: true, uid: true }
      }),
      prisma.user.findFirstOrThrow({
        where: { phone: guestPhone },
        select: { id: true, uid: true }
      })
    ]);

    const unauthenticatedUsers = await request<PageResult<UserProfile>>("/admin/users?page=1&pageSize=20");
    assert(unauthenticatedUsers.status === 401, "unauthenticated admin users should return 401");

    const lowVersionLogin = await request<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      headers: {
        "x-cook-from": "admin_web",
        "x-admin-version": "0.0.1",
        "x-admin-build": "0"
      },
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    assert(lowVersionLogin.status === 426, "low version admin login should return 426");

    const login = await requestData<AdminLoginResult>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: adminUsername, password: adminPassword })
    });
    assert(login.admin.username === adminUsername, "admin login username mismatch");

    const authorization = `Bearer ${login.token}`;
    const users = await requestData<PageResult<UserProfile>>("/admin/users?page=1&pageSize=100", {
      headers: { authorization }
    });
    assert(users.items.some(item => item.id === ownerUser.id), "admin users list missing owner");
    assert(users.items.some(item => item.id === guestUser.id), "admin users list missing guest");

    const diningGroups = await requestData<PageResult<AdminDiningGroupSummary>>("/admin/dining-groups?page=1&pageSize=100", {
      headers: { authorization }
    });
    const ownerGroup = diningGroups.items.find(item => item.ownerId === ownerUser.id);
    const guestGroup = diningGroups.items.find(item => item.ownerId === guestUser.id);
    assert(ownerGroup, "admin dining groups missing owner group");
    assert(guestGroup, "admin dining groups missing guest group");
    assert(ownerGroup.memberCount >= 1, "owner dining group memberCount invalid");
    assert(guestGroup.memberCount >= 1, "guest dining group memberCount invalid");

    const entitlements = await requestData<AdminUserEntitlementResponse>(`/admin/user-entitlements?userId=${ownerUser.id}`, {
      headers: { authorization }
    });
    assert(entitlements.user.id === ownerUser.id, "admin entitlement user mismatch");
    assert(entitlements.user.uid === ownerUser.uid, "admin entitlement uid mismatch");
    assert(entitlements.currentSpace.id === ownerGroup.id, "admin entitlement currentSpace mismatch");
    assert(typeof entitlements.entitlements.recipeLimit === "number", "admin entitlement recipeLimit missing");
    assert(typeof entitlements.entitlements.storageLimitBytes === "number", "admin entitlement storageLimitBytes missing");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          unauthenticatedUsersStatus: unauthenticatedUsers.status,
          lowVersionLoginStatus: lowVersionLogin.status,
          adminLoginOk: true,
          usersPageSize: users.pageSize,
          usersTotal: users.total,
          diningGroupsPageSize: diningGroups.pageSize,
          diningGroupsTotal: diningGroups.total,
          entitlementScope: entitlements.entitlements.currentScope
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
