import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  DiningEventSummary,
  HomeRecentArrangement,
  IngredientSummary,
  MealPlanSummary,
  MyRecipeDetail,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse,
  SharePreviewResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginUser {
  uid: number;
}

interface LoginResult {
  token: string;
  user: LoginUser;
}

interface SharePreviewViewerResponse {
  action: "ACCEPT" | "VIEW" | "BLOCKED";
  statusHint: string | null;
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
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

async function resolveRecipeCategory(ownerAuth: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: ownerAuth
  });
  if (categories.length) {
    return categories[0];
  }

  const suffix = nextIdempotencyKey().slice(-6);
  const created = await request<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `饭局验收分类${suffix}` })
  });
  if (created.status >= 200 && created.status < 300 && created.body.code === 0) {
    return created.body.data;
  }

  const fallback = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: ownerAuth
  });
  assert(
    fallback.length > 0,
    `/recipe-categories fallback failed after create HTTP ${created.status}: ${created.body.message}`
  );
  return fallback[0];
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow: number) {
  const extraDays = Number(nextIdempotencyKey().slice(-2)) % 20;
  return formatDateOnly(new Date(Date.now() + (daysFromNow + extraDays) * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function parseShareToken(shareTokenPath: string) {
  const url = new URL(shareTokenPath, "https://cook.local");
  const token = url.searchParams.get("token");
  assert(token, "share token should exist in shareTokenPath");
  return token;
}

async function login(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function loginWithCode(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

function createFreshPhone() {
  const suffix = nextIdempotencyKey().slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function resolvePlanWindow(minHours: number, maxHours: number) {
  const now = new Date();
  const slotCandidates: Array<{ mealSlot: "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT"; hour: number; minute: number }> = [
    { mealSlot: "BREAKFAST", hour: 8, minute: 0 },
    { mealSlot: "LUNCH", hour: 12, minute: 0 },
    { mealSlot: "AFTERNOON_TEA", hour: 15, minute: 30 },
    { mealSlot: "DINNER", hour: 18, minute: 30 },
    { mealSlot: "LATE_NIGHT", hour: 22, minute: 0 }
  ];
  let selected: { planDate: string; mealSlot: "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT"; diffHours: number } | null = null;

  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    for (const candidate of slotCandidates) {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(now.getDate() + dayOffset);
      scheduledAt.setHours(candidate.hour, candidate.minute, 0, 0);
      const diffHours = (scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000);
      if (diffHours < minHours || diffHours > maxHours) continue;
      if (!selected || diffHours < selected.diffHours) {
        selected = {
          planDate: formatDateOnly(scheduledAt),
          mealSlot: candidate.mealSlot,
          diffHours
        };
      }
    }
  }

  assert(selected, `failed to resolve meal slot within ${minHours}-${maxHours} hours`);
  return selected;
}

async function createOwnerRecipe(ownerAuth: Record<string, string>, namePrefix = "饭局验收菜谱") {
  const systemIngredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: ownerAuth
  });
  assert(systemIngredients.items.length > 0, "system ingredients should be readable");
  const ingredient = systemIngredients.items[0];
  const suffix = nextIdempotencyKey().slice(-6);
  const category = await resolveRecipeCategory(ownerAuth);
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `${namePrefix}${suffix}`,
        story: "用于饭局详情真实联调",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: null,
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "2",
            unitId: ingredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: "饭局脚本验收步骤",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const draftDetail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, {
    headers: ownerAuth
  });
  const published = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ expectedVersion: draftDetail.version })
  });
  return {
    ingredient,
    recipe: published.recipe
  };
}

async function createMealPlan(
  ownerAuth: Record<string, string>,
  recipe: MyRecipeDetail,
  options?: {
    planDate?: string;
    mealSlot?: "BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT";
    titlePrefix?: string;
  }
) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  const fixedPlanDate = options?.planDate ?? null;
  const fixedMealSlot = options?.mealSlot ?? "DINNER";
  const titlePrefix = options?.titlePrefix ?? "饭局验收餐次";
  const fallbackMealSlots: Array<"BREAKFAST" | "LUNCH" | "AFTERNOON_TEA" | "DINNER" | "LATE_NIGHT"> = [
    "DINNER",
    "LUNCH",
    "BREAKFAST",
    "AFTERNOON_TEA",
    "LATE_NIGHT"
  ];

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const mealSlot = fixedPlanDate ? fixedMealSlot : fallbackMealSlots[attempt % fallbackMealSlots.length];
    const planDate = fixedPlanDate ?? buildPlanDate(30 + Math.floor(attempt / fallbackMealSlots.length));
    const result = await request<MealPlanSummary>("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        planDate,
        mealSlot,
        title: `${titlePrefix}-${titleSuffix}-${attempt}`,
        menuItems: [
          {
            slotType: "MEAT",
            sortOrder: 0,
            recipeId: recipe.id,
            recipeVersionId: recipe.contentVersionId,
            purchaseState: "READY"
          }
        ]
      })
    });
    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }
    if (result.body.code === 409 && result.body.message.includes("计划已存在")) {
      continue;
    }
    throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
  }
  throw new Error("/meal-plans failed after 30 attempts due to existing plan conflicts");
}

async function verifyRecentArrangementBoundaries() {
  const unauthenticated = await request<HomeRecentArrangement | null>("/home/recent-arrangement");
  assert(
    unauthenticated.status === 200 && unauthenticated.body.code === 401,
    "unauthenticated /home/recent-arrangement should return business code 401"
  );

  const boundaryPhone = createFreshPhone();
  const boundaryUser = await loginWithCode(boundaryPhone);
  const boundaryAuth = { authorization: `Bearer ${boundaryUser.token}` };

  const noArrangement = await requestData<HomeRecentArrangement | null>("/home/recent-arrangement", {
    headers: boundaryAuth
  });
  assert(noArrangement === null, "fresh code-login user should not have recent arrangement");

  const { recipe: fallbackRecipe } = await createOwnerRecipe(boundaryAuth, "最近安排补位菜谱");
  const fallbackPlan = await createMealPlan(boundaryAuth, fallbackRecipe, {
    titlePrefix: "最近安排补位计划"
  });
  const fallbackEvent = await requestData<DiningEventSummary>(`/meal-plans/${fallbackPlan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(boundaryAuth),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(30),
      location: "最近安排补位饭局"
    })
  });
  const fallbackArrangement = await requestData<HomeRecentArrangement | null>("/home/recent-arrangement", {
    headers: boundaryAuth
  });
  assert(fallbackArrangement?.eventId === fallbackEvent.id, "24~36h fallback should pick the only fallback event");
  assert(fallbackArrangement.sourceType === "EVENT", "24~36h fallback should keep EVENT source type");

  const primaryWindow = resolvePlanWindow(1, 24);
  const primaryPlan = await createMealPlan(boundaryAuth, fallbackRecipe, {
    planDate: primaryWindow.planDate,
    mealSlot: primaryWindow.mealSlot,
    titlePrefix: "最近安排主窗口计划"
  });
  const arrangementWithPrimaryPlan = await requestData<HomeRecentArrangement | null>("/home/recent-arrangement", {
    headers: boundaryAuth
  });
  assert(arrangementWithPrimaryPlan?.sourceType === "PLAN", "primary window plan should outrank fallback event");
  assert(arrangementWithPrimaryPlan.planItemId === primaryPlan.id, "primary window plan should become current arrangement");

  const primaryEventPlan = await createMealPlan(boundaryAuth, fallbackRecipe, {
    titlePrefix: "最近安排主窗口饭局计划"
  });
  const primaryEvent = await requestData<DiningEventSummary>(`/meal-plans/${primaryEventPlan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(boundaryAuth),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(20),
      location: "最近安排主窗口饭局"
    })
  });
  const arrangementWithPlanAndEvent = await requestData<HomeRecentArrangement | null>("/home/recent-arrangement", {
    headers: boundaryAuth
  });
  assert(arrangementWithPlanAndEvent?.sourceType === "EVENT", "primary window should prefer event over plan");
  assert(arrangementWithPlanAndEvent.eventId === primaryEvent.id, "current arrangement should point to the preferred event");

  return {
    noArrangement,
    fallbackEventId: fallbackEvent.id,
    fallbackStatus: fallbackArrangement.status,
    primaryPlanId: primaryPlan.id,
    primaryPlanStatus: arrangementWithPrimaryPlan.status,
    preferredEventId: primaryEvent.id,
    preferredStatus: arrangementWithPlanAndEvent.status,
    unauthenticatedStatus: unauthenticated.status
  };
}

async function main() {
  const recentArrangementEvidence = await verifyRecentArrangementBoundaries();
  const owner = await login(ownerPhone);
  const member = await login(memberPhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };

  const { recipe } = await createOwnerRecipe(ownerAuth);
  const scheduledAt = buildFutureIso(2);
  const plan = await createMealPlan(ownerAuth, recipe);
  assert(plan.menuItems.length === 1, "plan should contain one menu item");

  const event = await requestData<DiningEventSummary>(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      scheduledAt,
      location: "验收饭局地点"
    })
  });
  assert(event.planItemId === plan.id, "event should be linked to plan");
  assert(event.menuItems.length === 1, "event should carry one menu item");
  assert(event.hasActiveShareLink, "event should create an active share invite");
  assert(event.shareTokenPath, "event owner should receive a share path at creation");

  const recentArrangement = await requestData<HomeRecentArrangement | null>("/home/recent-arrangement", {
    headers: ownerAuth
  });
  assert(recentArrangement, "recent arrangement should exist after creating the dining event");

  const shareToken = parseShareToken(event.shareTokenPath);

  const preview = await requestData<SharePreviewResponse>(`/share/${shareToken}/preview`);
  assert(preview.eventId === event.id, "share preview should expose the same event id");
  assert(preview.planItemId === plan.id, "share preview should expose the same plan item");
  assert(preview.title === event.title, "share preview title should match event title");
  assert(preview.inviteStatus === "OPENED", "share preview should mark first-open invite as OPENED");
  assert(preview.participants.length === 0, "share preview should not include non-accepted participants before join");

  const memberViewerBeforeJoin = await requestData<SharePreviewViewerResponse>(`/share/${shareToken}/viewer`, {
    headers: memberAuth
  });
  assert(memberViewerBeforeJoin.action === "ACCEPT", "fresh logged-in viewer should still need to accept invite");

  const joined = await requestData<DiningEventSummary>(`/share/${shareToken}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({ guestName: "饭局验收成员" })
  });
  const ownerAfterJoin = await requestData<DiningEventSummary>(`/dining-events/${event.id}`, { headers: ownerAuth });
  assert(ownerAfterJoin.shareTokenPath, "event owner should receive the next share path after an invite is accepted");
  assert(ownerAfterJoin.shareTokenPath !== event.shareTokenPath, "accepted invite should be replaced by a fresh share path");
  const memberAfterJoin = await requestData<DiningEventSummary>(`/dining-events/${event.id}`, { headers: memberAuth });
  assert(memberAfterJoin.shareTokenPath === null, "participant must not receive the owner share path");
  const joinedParticipant = joined.participants.find(item => item.userUid === member.user.uid);
  assert(joinedParticipant?.status === "ACCEPTED", "member should join the event as ACCEPTED");

  const previewAfterJoin = await requestData<SharePreviewResponse>(`/share/${shareToken}/preview`);
  assert(previewAfterJoin.participants.length === 1, "share preview should only list accepted participants after join");
  assert(
    previewAfterJoin.participants[0]?.displayName === "饭局验收成员",
    "share preview should expose the accepted participant display name"
  );

  const memberViewerAfterJoin = await requestData<SharePreviewViewerResponse>(`/share/${shareToken}/viewer`, {
    headers: memberAuth
  });
  assert(memberViewerAfterJoin.action === "VIEW", "accepted member should be able to view the dining event");

  const ownerViewer = await requestData<SharePreviewViewerResponse>(`/share/${shareToken}/viewer`, {
    headers: ownerAuth
  });
  assert(ownerViewer.action === "VIEW", "organizer should be able to view the dining event");

  const outsider = await loginWithCode(createFreshPhone());
  const outsiderAuth = { authorization: `Bearer ${outsider.token}` };
  const outsiderViewer = await requestData<SharePreviewViewerResponse>(`/share/${shareToken}/viewer`, {
    headers: outsiderAuth
  });
  assert(outsiderViewer.action === "BLOCKED", "invite already used by another account should be blocked");

  const memberView = await requestData<DiningEventSummary>(`/dining-events/${event.id}`, {
    headers: memberAuth
  });
  assert(memberView.id === event.id, "joined member should be able to read dining event detail");

  const memberRecipe = await createOwnerRecipe(memberAuth, "饭局验收成员菜谱");
  const wished = await requestData<DiningEventSummary>(`/dining-events/${event.id}/wishes`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      recipeId: memberRecipe.recipe.id
    })
  });
  const wishedItem = wished.wishItems.find(item => item.recipeId === memberRecipe.recipe.id);
  assert(wishedItem, "member wish should appear in wish pool");
  assert(wishedItem.supportedByMe === true, "creator should automatically support own wish");

  const ownerView = await requestData<DiningEventSummary>(`/dining-events/${event.id}`, {
    headers: ownerAuth
  });
  const ownerWishItem = ownerView.wishItems.find(item => item.id === wishedItem.id);
  assert(ownerWishItem, "owner should see wish pool item");

  const addedToMenu = await requestData<DiningEventSummary>(`/dining-events/${event.id}/wishes/${wishedItem.id}/menu`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth)
  });
  const addedMenuItem = addedToMenu.menuItems.find(item => item.recipeVersionId === memberRecipe.recipe.contentVersionId);
  assert(addedMenuItem, "owner should be able to add wished recipe into current menu");

  const bringUpdated = await requestData<DiningEventSummary>(`/dining-events/${event.id}/bring`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      recipeId: memberRecipe.recipe.id
    })
  });
  const memberBring = bringUpdated.participants.find(item => item.userUid === member.user.uid);
  assert(memberBring?.bringRecipeId === memberRecipe.recipe.id, "member bring recipe should be recorded independently");

  const disabled = await requestData<DiningEventSummary>(`/dining-events/${event.id}/share-link/disable`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth)
  });
  assert(disabled.hasActiveShareLink === false, "share link should become inactive after disable");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        recentArrangementEvidence,
        planItemId: plan.id,
        eventId: event.id,
        recentArrangementStatus: recentArrangement.status,
        shareTokenPath: event.shareTokenPath,
        previewPlanItemId: preview.planItemId,
        previewAcceptedParticipantCount: previewAfterJoin.participants.length,
        memberViewerAction: memberViewerAfterJoin.action,
        outsiderViewerAction: outsiderViewer.action,
        joinedParticipantStatus: joinedParticipant.status,
        wishedRecipeId: wishedItem.id,
        wishAddedToMenu: Boolean(addedMenuItem),
        bringRecipeTitle: memberBring?.bringRecipeTitle ?? null,
        shareDisabled: disabled.hasActiveShareLink === false
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
