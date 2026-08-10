import { loadLocalEnv } from "../src/common/load-env";
import type {
  DiningEventSummary,
  GetMyDiningGroupsResponse,
  IngredientSummary,
  MealPlanSummary,
  MyRecipeDetail,
  MyRecipeSummary,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  RecipeSceneSummary,
  SaveRecipeDraftResponse,
  ShoppingItemSummary
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const freePhone = process.env.TEST_FREE_PHONE ?? "13900000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
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

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-cook-from": "mini_program",
      "x-cook-version": "0.1.0",
      ...options.headers
    }
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

async function login(phone: string) {
  return requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password })
  });
}

async function ensureMemberJoinedOwnerGroup(ownerAuth: Record<string, string>, memberAuth: Record<string, string>, ownerGroupId: number) {
  const memberGroups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: memberAuth });
  if (memberGroups.items.some(item => item.id === ownerGroupId && item.myStatus === "ACTIVE")) {
    return;
  }

  const invite = await requestData<{ inviteToken: string }>("/dining-group-invites", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      diningGroupId: ownerGroupId
    })
  });

  await requestData(`/dining-group-invites/${encodeURIComponent(invite.inviteToken)}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth)
  });
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function findAvailablePlanDate(plans: MealPlanSummary[]) {
  const usedDinnerDates = new Set(plans.filter(item => item.mealSlot === "DINNER").map(item => item.planDate));
  const start = new Date("2026-07-24T00:00:00.000Z");
  for (let offset = 0; offset < 30; offset += 1) {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + offset);
    const planDate = formatDate(next);
    if (!usedDinnerDates.has(planDate)) {
      return planDate;
    }
  }
  throw new Error("no available dinner slot for verify flow");
}

function amountText(amount: MyRecipeDetail["content"]["ingredients"][number]["amount"]) {
  return amount.kind === "EXACT" ? `${amount.quantity}${amount.unitName}` : amount.text;
}

async function createPublishedRecipe(
  auth: Record<string, string>,
  ingredient: IngredientSummary,
  label: string
) {
  const suffix = nextIdempotencyKey().slice(-6);
  const category = await requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(auth),
    body: JSON.stringify({ name: `${label}分类${suffix}` })
  });
  const scene = await requestData<RecipeSceneSummary>("/recipe-scenes", {
    method: "POST",
    headers: withIdempotencyKey(auth),
    body: JSON.stringify({ name: `${label}场景${suffix}` })
  });
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(auth),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `${label}菜谱${suffix}`,
        story: null,
        categoryId: category.id,
        sceneIds: [scene.id],
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: null,
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "",
            unitId: null,
            fuzzyText: "适量",
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [{ text: `${label}验收步骤` }]
      }
    })
  });
  const draftDetail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, {
    headers: auth
  });
  const publish = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(auth),
    body: JSON.stringify({ expectedVersion: draftDetail.version })
  });
  return publish.recipe;
}

async function main() {
  const owner = await login(ownerPhone);
  const member = await login(memberPhone);
  const freeUser = await login(freePhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };
  const freeAuth = { authorization: `Bearer ${freeUser.token}` };

  const ownerGroups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: ownerAuth });
  const ownerGroup = ownerGroups.items.find(item => item.isOwned);
  assert(ownerGroup, "owner should have an owned dining group");
  await ensureMemberJoinedOwnerGroup(ownerAuth, memberAuth, ownerGroup.id);

  const systemIngredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: memberAuth
  });
  const memberIngredient = systemIngredients.items[0];
  assert(memberIngredient, "system ingredient should be readable");
  const memberBringRecipe = await createPublishedRecipe(memberAuth, memberIngredient, "带菜");

  const ownerRecipes = await requestData<PageResult<MyRecipeSummary>>("/recipes?page=1&pageSize=20", {
    headers: ownerAuth
  });
  const ownerRecipe = ownerRecipes.items.find(item => item.id > 0);
  assert(ownerRecipe, "owner should have seeded personal recipe");
  const ownerRecipeDetail = await requestData<MyRecipeDetail>(`/recipes/${ownerRecipe.id}`, {
    headers: ownerAuth
  });

  const ownerPlans = await requestData<PageResult<MealPlanSummary>>("/meal-plans?page=1&pageSize=100", {
    headers: ownerAuth
  });
  const planDate = findAvailablePlanDate(ownerPlans.items);

  const mealPlan = await requestData<MealPlanSummary>("/meal-plans", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      planDate,
      mealSlot: "DINNER",
      recipeIds: [ownerRecipe.id]
    })
  });
  assert(mealPlan.title.length > 0, "meal plan should use fixed menu snapshot");

  const event = await requestData<DiningEventSummary>(`/meal-plans/${mealPlan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      scheduledAt: `${planDate}T19:00:00.000Z`,
      location: "家里"
    })
  });
  assert(event.shareTokenPath?.includes("/pages_share/preview/index?token="), "created event should return a share preview path");

  const inviteResult = await requestData<DiningEventSummary>(`/dining-events/${event.id}/invite-group`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      diningGroupId: ownerGroup.id
    })
  });
  assert(inviteResult.participants.some(item => item.status === "INVITED"), "group invite should create invited participants");

  const respondResult = await requestData<DiningEventSummary>(`/dining-events/${event.id}/respond`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      status: "ACCEPTED"
    })
  });
  assert(respondResult.participants.some(item => item.userUid === 91827364 && item.status === "ACCEPTED"), "member should accept event invite");

  const bringResult = await requestData<DiningEventSummary>(`/dining-events/${event.id}/bring`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      recipeId: memberBringRecipe.id
    })
  });
  assert(
    bringResult.participants.some(item => item.userUid === 91827364 && item.bringRecipeId === memberBringRecipe.id),
    "bring dish should bind participant recipe"
  );

  const shareToken = event.shareTokenPath?.split("token=")[1];
  assert(shareToken, "share token should be extractable from share path");
  const sharePreview = await requestData<{ organizerUid: number }>(`/share/${encodeURIComponent(shareToken)}/preview`);
  assert(sharePreview.organizerUid === 52738164, "share preview should expose organizer white-list fields");

  const shareAccept = await requestData<DiningEventSummary>(`/share/${encodeURIComponent(shareToken)}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(freeAuth),
    body: JSON.stringify({
      guestName: "外部来客"
    })
  });
  assert(shareAccept.participants.some(item => item.guestName === "外部来客"), "share accept should append external participant");

  const forbiddenGap = await request<unknown>(`/dining-events/${event.id}/shopping-gap`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth)
  });
  assert(forbiddenGap.status === 404, "non-owner should not preview owner shopping gap");

  const fridgeIngredient = ownerRecipeDetail.content.ingredients[0];
  assert(fridgeIngredient, "owner recipe should have at least one ingredient");
  const expectedGapNames =
    ownerRecipeDetail.content.ingredients.length > 1
      ? ownerRecipeDetail.content.ingredients.slice(1).map(item => item.ingredientName)
      : [fridgeIngredient.ingredientName];

  await requestData("/fridge-items", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: ownerRecipeDetail.content.ingredients.length > 1 ? fridgeIngredient.ingredientName : "已有库存",
      quantityText: amountText(fridgeIngredient.amount),
      note: "已有库存"
    })
  });

  const gapPreview = await requestData<ShoppingItemSummary[]>(`/shopping-gap`, {
    headers: ownerAuth
  });
  assert(gapPreview.some(item => expectedGapNames.includes(item.name)), "event gap should compare event menu with personal fridge");
  assert(gapPreview.some(item => item.sourceTitles.includes(event.title)), "gap preview should expose owning event titles");

  const gapCreate = await requestData<ShoppingItemSummary[]>(`/dining-events/${event.id}/shopping-gap`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth)
  });
  assert(gapCreate.length >= 1, "event gap should write shopping items");

  const shoppingList = await requestData<PageResult<ShoppingItemSummary>>("/shopping-items?status=OPEN&page=1&pageSize=20", {
    headers: ownerAuth
  });
  assert(shoppingList.items.some(item => item.sourceType === "EVENT"), "shopping list should persist event-derived items");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        memberRecipeId: memberBringRecipe.id,
        mealPlanId: mealPlan.id,
        eventId: event.id,
        gapCount: gapCreate.length
      },
      null,
      2
    )
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
