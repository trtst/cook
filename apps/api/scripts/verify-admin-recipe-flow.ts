import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type { AdminRecipeSummary, PageResult, RecipeReportSummary, RecipeSummary } from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string, options: RequestInit = {}, admin = false) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(admin
        ? {
            "x-cook-from": "admin_web",
            "x-admin-version": "0.1.0",
            "x-admin-build": "1"
          }
        : {
            "x-cook-from": "mini_program",
            "x-cook-version": "0.1.0"
          }),
      ...options.headers
    }
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

async function main() {
  const prisma = new PrismaClient();
  const owner = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: ownerPhone, password })
  });
  const member = await requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: memberPhone, password })
  });
  const admin = await requestData<LoginResult>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  }, true);

  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };
  const adminAuth = { authorization: `Bearer ${admin.token}` };

  const ownerRecipes = await requestData<PageResult<RecipeSummary>>("/recipes?scope=mine&page=1&pageSize=20", {
    headers: ownerAuth
  });
  const targetRecipe = ownerRecipes.items.find(item => item.status === "ACTIVE");
  assert(targetRecipe, "owner should have at least one recipe");

  await requestData(`/recipes/${targetRecipe.id}/report`, {
    method: "POST",
    headers: memberAuth,
    body: JSON.stringify({ operationId: crypto.randomUUID(), reason: "后台治理验证" })
  });

  const recipeList = await requestData<PageResult<AdminRecipeSummary>>("/admin/recipes?page=1&pageSize=20&reportsOnly=true", {
    headers: adminAuth
  }, true);
  assert(recipeList.items.some(item => item.id === targetRecipe.id), "admin recipe list should expose reported recipe");

  const reportList = await requestData<PageResult<RecipeReportSummary>>("/admin/recipe-reports?page=1&pageSize=20&status=OPEN", {
    headers: adminAuth
  }, true);
  const report = reportList.items.find(item => item.recipeId === targetRecipe.id);
  assert(report, "open report should be visible in admin");

  const blockAuditCount = await prisma.auditEvent.count({
    where: { action: "RECIPE_BLOCKED", objectId: targetRecipe.id }
  });
  const blockOperationId = crypto.randomUUID();
  const blockOptions = {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({ operationId: blockOperationId, reason: "治理验证下架" })
  };
  const [block1, block2] = await Promise.all([
    requestData<AdminRecipeSummary>(`/admin/recipes/${targetRecipe.id}/block`, blockOptions, true),
    requestData<AdminRecipeSummary>(`/admin/recipes/${targetRecipe.id}/block`, blockOptions, true)
  ]);
  assert(block1.id === block2.id && block1.status === "BLOCKED", "concurrent block replay should return the first result");
  const changedBlock = await request<AdminRecipeSummary>(`/admin/recipes/${targetRecipe.id}/block`, {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({ operationId: blockOperationId, reason: "不同下架原因" })
  }, true);
  assert(changedBlock.status === 409, "reusing an operationId with another block reason should return 409");
  assert(
    (await prisma.auditEvent.count({ where: { action: "RECIPE_BLOCKED", objectId: targetRecipe.id } })) === blockAuditCount + 1,
    "concurrent block replay should write one audit event"
  );

  const blockedDetail = await request<RecipeSummary>(`/recipes/${targetRecipe.id}`, { headers: memberAuth });
  assert(blockedDetail.status === 404, "blocked recipe should not remain visible to other users");

  const resolveAuditCount = await prisma.auditEvent.count({
    where: { action: "RECIPE_REPORT_RESOLVED", objectId: report.id }
  });
  const resolveOperationId = crypto.randomUUID();
  const resolveOptions = {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({ operationId: resolveOperationId, resolutionNote: "已核查" })
  };
  const [resolve1, resolve2] = await Promise.all([
    requestData<RecipeReportSummary>(`/admin/recipe-reports/${report.id}/resolve`, resolveOptions, true),
    requestData<RecipeReportSummary>(`/admin/recipe-reports/${report.id}/resolve`, resolveOptions, true)
  ]);
  assert(resolve1.id === resolve2.id && resolve1.status === "RESOLVED", "concurrent resolve replay should return the first result");
  assert(
    (await prisma.auditEvent.count({ where: { action: "RECIPE_REPORT_RESOLVED", objectId: report.id } })) === resolveAuditCount + 1,
    "concurrent resolve replay should write one audit event"
  );

  const resolvedReports = await requestData<PageResult<RecipeReportSummary>>("/admin/recipe-reports?page=1&pageSize=20&status=RESOLVED", {
    headers: adminAuth
  }, true);
  assert(resolvedReports.items.some(item => item.id === report.id), "resolved report should be queryable");

  const unblockAuditCount = await prisma.auditEvent.count({
    where: { action: "RECIPE_UNBLOCKED", objectId: targetRecipe.id }
  });
  const unblockOperationId = crypto.randomUUID();
  const unblockOptions = {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({ operationId: unblockOperationId })
  };
  const [unblock1, unblock2] = await Promise.all([
    requestData<AdminRecipeSummary>(`/admin/recipes/${targetRecipe.id}/unblock`, unblockOptions, true),
    requestData<AdminRecipeSummary>(`/admin/recipes/${targetRecipe.id}/unblock`, unblockOptions, true)
  ]);
  assert(unblock1.id === unblock2.id && unblock1.status === "ACTIVE", "concurrent unblock replay should return the first result");
  assert(
    (await prisma.auditEvent.count({ where: { action: "RECIPE_UNBLOCKED", objectId: targetRecipe.id } })) === unblockAuditCount + 1,
    "concurrent unblock replay should write one audit event"
  );

  const restoredDetail = await requestData<RecipeSummary>(`/recipes/${targetRecipe.id}`, { headers: memberAuth });
  assert(restoredDetail.id === targetRecipe.id, "unblocked recipe should become visible again");

  await prisma.$disconnect();

  console.log(JSON.stringify({ apiBaseUrl, recipeId: targetRecipe.id, reportId: report.id }, null, 2));
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
