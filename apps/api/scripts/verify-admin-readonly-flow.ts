import type {
  AdminDashboardSummary,
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

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
  admin: { id: number; username: string };
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
  const dashboard = await requestData<AdminDashboardSummary>("/admin/dashboard/summary", {
    headers: { authorization }
  });
  assert(dashboard.user.total >= dashboard.user.activeCount, "dashboard user total should cover active count");
  assert(dashboard.user.total >= dashboard.user.disabledCount, "dashboard user total should cover disabled count");
  assert(
    dashboard.recipe.total >= dashboard.recipe.activeCount + dashboard.recipe.blockedCount + dashboard.recipe.recycledCount,
    "dashboard recipe total should cover visible status counts"
  );

  const users = await requestData<PageResult<UserProfile>>("/admin/users?page=1&pageSize=100", {
    headers: { authorization }
  });
  const ownerUser = users.items.find(item => item.phone === ownerPhone);
  assert(ownerUser, "admin users list missing owner user");

  const diningGroups = await requestData<PageResult<AdminDiningGroupSummary>>("/admin/dining-groups?page=1&pageSize=100", {
    headers: { authorization }
  });
  assert(diningGroups.items.length > 0, "admin dining groups should not be empty");
  assert(diningGroups.items.every(item => item.status === "ACTIVE" || item.status === "ARCHIVED"), "unexpected dining group status");

  const entitlements = await requestData<AdminUserEntitlementResponse>(`/admin/user-entitlements?userId=${ownerUser.id}`, {
    headers: { authorization }
  });
  assert(entitlements.user.id === ownerUser.id, "admin entitlement user mismatch");
  assert(entitlements.membership.tier.length > 0, "admin membership tier missing");
  assert(Array.isArray(entitlements.diningGroups), "admin dining groups summary missing");
  assert(entitlements.storage.calculatedAt.length > 0, "admin storage summary missing calculation time");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        unauthenticatedUsersStatus: unauthenticatedUsers.status,
        lowVersionLoginStatus: lowVersionLogin.status,
        adminLoginOk: true,
        dashboardOpenReports: dashboard.recipe.openReportCount,
        dashboardUnitCount: dashboard.ingredient.unitCount,
        usersTotal: users.total,
        diningGroupsTotal: diningGroups.total,
        ownerTier: entitlements.membership.tier,
        ownerRelationCount: entitlements.diningGroups.length
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
