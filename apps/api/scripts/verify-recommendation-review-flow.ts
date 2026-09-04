import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface CodeLoginResult {
  token: string;
  expiresAt: string;
  user: {
    uid: number;
  };
}

interface AdminLoginResult {
  token: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

interface IngredientCategorySummary {
  id: number;
  name: string;
}

interface UnitSummary {
  id: number;
  name: string;
  type: "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
}

interface IngredientSummary {
  id: number;
  name: string;
  categoryId: number;
  defaultUnit: UnitSummary;
  source: "SYSTEM" | "PERSONAL";
  version: number;
}

interface IngredientRecommendationSummary {
  id: number;
  ingredientId: number;
  ingredientVersion: number;
  ingredientName: string;
  status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
  reviewNote: string | null;
  reviewAdvice: string | null;
  adoptedIngredient: IngredientSummary | null;
  mergedIngredient: IngredientSummary | null;
}

interface UnitRecommendationSummary {
  id: number;
  unitName: string;
  unitType: "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
  status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
  reviewNote: string | null;
  reviewAdvice: string | null;
  targetUnit: UnitSummary | null;
}

interface AdminPendingIngredientSummary {
  id: number;
  name: string;
  version: number;
  categoryId: number | null;
  defaultUnitId: number | null;
}

interface AdminPendingUnitRecommendationSummary {
  id: number;
  name: string;
  type: "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
  version: number;
}

let idempotencySeed = Date.now();

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

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
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

async function loginUserWithCode(phone: string) {
  return loginWithPassword(requestData, phone, password);
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
  const userSession = await loginUserWithCode(createFreshPhone());
  const adminSession = await loginAdmin();
  const userAuth = { authorization: `Bearer ${userSession.token}` };
  const adminAuth = { authorization: `Bearer ${adminSession.token}` };

  const categories = await requestData<IngredientCategorySummary[]>("/ingredient-categories", {
    headers: userAuth
  });
  assert(categories.length > 0, "missing ingredient categories");

  const units = await requestData<PageResult<UnitSummary>>("/units?page=1&pageSize=100&source=SYSTEM", {
    headers: userAuth
  });
  assert(units.items.length > 0, "missing system units");

  const category = categories[0];
  const defaultUnit = units.items[0];
  const ingredientName = `推荐验收食材${nextIdempotencyKey().slice(-6)}`;
  const retriedIngredientName = `${ingredientName}改`;
  const unitName = `推荐验收单位${nextIdempotencyKey().slice(-6)}`;

  const createdIngredient = await requestData<IngredientSummary>("/ingredients", {
    method: "POST",
    headers: withIdempotencyKey(userAuth),
    body: JSON.stringify({
      name: ingredientName,
      categoryId: category.id,
      defaultUnitId: defaultUnit.id
    })
  });
  assert(createdIngredient.source === "PERSONAL", "new ingredient should be personal");

  const firstRecommendation = await requestData<IngredientRecommendationSummary>(
    `/ingredients/${createdIngredient.id}/recommendations`,
    {
      method: "POST",
      headers: withIdempotencyKey(userAuth)
    }
  );
  assert(firstRecommendation.status === "PENDING", "first ingredient recommendation should be pending");

  const pendingIngredients = await requestData<PageResult<AdminPendingIngredientSummary>>(
    `/admin/pending-ingredients?page=1&pageSize=20&keyword=${encodeURIComponent(ingredientName)}`,
    { headers: adminAuth },
    true
  );
  const pendingIngredient = pendingIngredients.items.find((item) => item.id === createdIngredient.id);
  assert(pendingIngredient, "pending ingredient should be visible in admin");

  const rejectedIngredient = await requestData<{ id: number; status: "REJECTED"; reviewedAt: string; targetIngredientId: number | null }>(
    `/admin/pending-ingredients/${createdIngredient.id}/review`,
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        action: "REJECT",
        expectedVersion: pendingIngredient.version,
        rejectReasonCode: "NAME_NOT_CLEAR"
      })
    },
    true
  );
  assert(rejectedIngredient.status === "REJECTED", "ingredient recommendation should be rejected");

  const rejectedRecommendations = await requestData<PageResult<IngredientRecommendationSummary>>(
    "/ingredient-recommendations?page=1&pageSize=20",
    { headers: userAuth }
  );
  const rejectedRecord = rejectedRecommendations.items.find((item) => item.id === firstRecommendation.id);
  assert(rejectedRecord, "rejected ingredient recommendation should be visible to the user");
  assert(rejectedRecord.status === "REJECTED", "user ingredient recommendation should show rejected status");
  assert(rejectedRecord.reviewNote, "rejected ingredient recommendation should include review note");
  assert(rejectedRecord.reviewAdvice, "rejected ingredient recommendation should include review advice");

  const personalIngredients = await requestData<PageResult<IngredientSummary>>(
    `/ingredients?page=1&pageSize=20&source=PERSONAL&keyword=${encodeURIComponent(ingredientName)}`,
    { headers: userAuth }
  );
  const editableIngredient = personalIngredients.items.find((item) => item.id === createdIngredient.id);
  assert(editableIngredient, "rejected ingredient should remain editable");

  const updatedIngredient = await requestData<IngredientSummary>(
    `/ingredients/${createdIngredient.id}`,
    {
      method: "PUT",
      headers: withIdempotencyKey(userAuth),
      body: JSON.stringify({
        expectedVersion: editableIngredient.version,
        name: retriedIngredientName,
        categoryId: category.id,
        defaultUnitId: defaultUnit.id
      })
    }
  );
  assert(updatedIngredient.name === retriedIngredientName, "ingredient should be updated before retry");

  const retriedRecommendation = await requestData<IngredientRecommendationSummary>(
    `/ingredients/${createdIngredient.id}/recommendations`,
    {
      method: "POST",
      headers: withIdempotencyKey(userAuth)
    }
  );
  assert(retriedRecommendation.status === "PENDING", "retried ingredient recommendation should return to pending");

  const retriedPendingIngredients = await requestData<PageResult<AdminPendingIngredientSummary>>(
    `/admin/pending-ingredients?page=1&pageSize=20&keyword=${encodeURIComponent(retriedIngredientName)}`,
    { headers: adminAuth },
    true
  );
  const retriedPendingIngredient = retriedPendingIngredients.items.find((item) => item.id === createdIngredient.id);
  assert(retriedPendingIngredient, "retried pending ingredient should be visible in admin");

  const approvedIngredient = await requestData<{ id: number; status: "APPROVED"; reviewedAt: string; targetIngredientId: number | null }>(
    `/admin/pending-ingredients/${createdIngredient.id}/review`,
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        action: "APPROVE_CREATE",
        expectedVersion: retriedPendingIngredient.version,
        name: retriedIngredientName,
        categoryId: category.id,
        defaultUnitId: defaultUnit.id
      })
    },
    true
  );
  assert(approvedIngredient.status === "APPROVED", "retried ingredient recommendation should be approved");
  assert(approvedIngredient.targetIngredientId, "approved ingredient should resolve to a system ingredient");

  const finalIngredientRecommendations = await requestData<PageResult<IngredientRecommendationSummary>>(
    "/ingredient-recommendations?page=1&pageSize=20",
    { headers: userAuth }
  );
  const approvedRecord = finalIngredientRecommendations.items.find((item) => item.id === retriedRecommendation.id);
  assert(approvedRecord, "approved ingredient recommendation should be visible to the user");
  assert(approvedRecord.status === "ADOPTED", "approved ingredient recommendation should become adopted");
  assert(approvedRecord.adoptedIngredient?.id === approvedIngredient.targetIngredientId, "approved ingredient should expose adopted target");

  const systemIngredients = await requestData<PageResult<IngredientSummary>>(
    `/ingredients?page=1&pageSize=20&source=SYSTEM&keyword=${encodeURIComponent(retriedIngredientName)}`,
    { headers: userAuth }
  );
  assert(
    systemIngredients.items.some((item) => item.id === approvedIngredient.targetIngredientId),
    "approved ingredient should appear in system ingredients"
  );

  const unitRecommendation = await requestData<UnitRecommendationSummary>("/units", {
    method: "POST",
    headers: withIdempotencyKey(userAuth),
    body: JSON.stringify({
      name: unitName,
      type: "PACKAGE"
    })
  });
  assert(unitRecommendation.status === "PENDING", "unit recommendation should be pending");

  const pendingUnits = await requestData<PageResult<AdminPendingUnitRecommendationSummary>>(
    `/admin/pending-units?page=1&pageSize=20&keyword=${encodeURIComponent(unitName)}`,
    { headers: adminAuth },
    true
  );
  const pendingUnit = pendingUnits.items.find((item) => item.id === unitRecommendation.id);
  assert(pendingUnit, "pending unit recommendation should be visible in admin");

  const approvedUnit = await requestData<{ id: number; status: "APPROVED"; reviewedAt: string; targetUnitId: number | null }>(
    `/admin/pending-units/${unitRecommendation.id}/review`,
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        action: "APPROVE",
        expectedVersion: pendingUnit.version,
        name: unitName,
        type: "PACKAGE"
      })
    },
    true
  );
  assert(approvedUnit.status === "APPROVED", "unit recommendation should be approved");
  assert(approvedUnit.targetUnitId, "approved unit should create or link a system unit");

  const finalUnitRecommendations = await requestData<PageResult<UnitRecommendationSummary>>(
    "/unit-recommendations?page=1&pageSize=20",
    { headers: userAuth }
  );
  const approvedUnitRecord = finalUnitRecommendations.items.find((item) => item.id === unitRecommendation.id);
  assert(approvedUnitRecord, "approved unit recommendation should be visible to the user");
  assert(approvedUnitRecord.status === "ADOPTED", "approved unit recommendation should become adopted");
  assert(approvedUnitRecord.targetUnit?.id === approvedUnit.targetUnitId, "approved unit should expose target unit");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        ingredient: {
          ingredientId: createdIngredient.id,
          rejectedRecommendationId: firstRecommendation.id,
          approvedRecommendationId: retriedRecommendation.id,
          targetIngredientId: approvedIngredient.targetIngredientId
        },
        unit: {
          recommendationId: unitRecommendation.id,
          targetUnitId: approvedUnit.targetUnitId
        }
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
