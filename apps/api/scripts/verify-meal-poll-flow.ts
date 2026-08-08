import { loadLocalEnv } from "../src/common/load-env";
import type {
  GetMyDiningGroupsResponse,
  IngredientSummary,
  MyRecipeDetail,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  RecipeSceneSummary,
  SaveRecipeDraftResponse,
  UUID
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER";
type MealPollStatus = "OPEN" | "CLOSED" | "CONFIRMED" | "COMPLETED";
type DiningGroupActivityKind =
  | "POLL_OPENED"
  | "POLL_VOTED"
  | "POLL_SUGGESTED"
  | "POLL_NOTED"
  | "MENU_CONFIRMED"
  | "COOK_CLAIMED";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
  user: { uid: number };
}

interface MealPollSummary {
  id: UUID;
  diningGroupId: UUID;
  title: string;
  planDate: string;
  mealSlot: MealSlot;
  status: MealPollStatus;
  deadlineAt: string;
  choiceLimit: number;
  note: string | null;
  candidateCount: number;
  responseCount: number;
  confirmedPlanItemId: UUID | null;
  confirmedDiningEventId: UUID | null;
  version: number;
  createdAt: string;
}

interface MealPollCandidateSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID | null;
  title: string;
  coverUrl: string | null;
  status: "ACTIVE" | "PENDING" | "REJECTED";
  sourceType: "RECIPE" | "SUGGESTION";
  suggestedByUid: number | null;
  voteCount: number;
}

interface MealPollResponseSummary {
  id: UUID;
  userUid: number;
  selectedCandidateIds: UUID[];
  suggestionCandidateId: UUID | null;
  note: string | null;
  respondedAt: string;
}

interface MealPollDetail extends MealPollSummary {
  candidates: MealPollCandidateSummary[];
  responses: MealPollResponseSummary[];
}

interface DiningGroupActivitySummary {
  id: UUID;
  diningGroupId: UUID;
  kind: DiningGroupActivityKind;
  state: "PENDING" | "DONE" | "EXPIRED";
  actorUid: number | null;
  actorName: string | null;
  title: string;
  detail: string | null;
  pollId: UUID | null;
  planItemId: UUID | null;
  diningEventId: UUID | null;
  createdAt: string;
}

interface DiningEventMenuItemSummary {
  id: UUID;
  recipeId: UUID | null;
  recipeVersionId: UUID;
  title: string;
  cookUserUid: number | null;
  cookName: string | null;
  version: number;
}

interface DiningEventParticipantSummary {
  id: UUID;
  userUid: number | null;
  guestName: string | null;
  sourceType: "DINING_GROUP" | "SHARE";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";
  bringRecipeId: UUID | null;
  bringRecipeTitle: string | null;
}

interface DiningEventSummary {
  id: UUID;
  title: string;
  scheduledAt: string;
  location: string | null;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  planItemId: UUID | null;
  diningGroupId: UUID | null;
  menuItems: DiningEventMenuItemSummary[];
  participants: DiningEventParticipantSummary[];
  shareTokenPath: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
}

interface MealPlanSummary {
  id: UUID;
  planDate: string;
  mealSlot: MealSlot;
  title: string;
  menuItems: Array<{
    recipeId: UUID | null;
    recipeVersionId: UUID;
    title: string;
    sortOrder: number;
  }>;
  status: "PLANNED" | "COMPLETED";
  completedAt: string | null;
  hasDiningEvent: boolean;
  diningEventId: UUID | null;
  createdAt: string;
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

async function requestStatus<T>(path: string, expectedStatus: number, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(
    result.status === expectedStatus,
    `${path} expected HTTP ${expectedStatus}, got ${result.status}: ${result.body.message}`
  );
  return result;
}

async function login(phone: string) {
  return requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password })
  });
}

async function ensureMemberJoinedOwnerGroup(ownerAuth: Record<string, string>, memberAuth: Record<string, string>, ownerGroupId: UUID) {
  const memberGroups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: memberAuth });
  if (memberGroups.items.some(item => item.id === ownerGroupId && item.myStatus === "ACTIVE")) {
    return;
  }

  const invite = await requestData<{ inviteToken: string }>("/dining-group-invites", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ diningGroupId: ownerGroupId })
  });

  await requestData(`/dining-group-invites/${encodeURIComponent(invite.inviteToken)}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth)
  });
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildFutureDate(offsetDays: number) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

function findAvailablePollDate(polls: MealPollSummary[], mealSlot: MealSlot) {
  const usedDates = new Set(
    polls.filter(item => item.mealSlot === mealSlot && item.status !== "COMPLETED").map(item => item.planDate)
  );

  for (let offset = 1; offset <= 30; offset += 1) {
    const planDate = formatDate(buildFutureDate(offset));
    if (!usedDates.has(planDate)) {
      return planDate;
    }
  }

  throw new Error(`no available ${mealSlot} slot for verify meal poll flow`);
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
            quantity: "",
            unitId: null,
            fuzzyText: "适量",
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
          steps: [
            {
              slotKey: "step-1",
              text: `${label}验收步骤`,
              uploadId: null,
              imageUrl: null
            }
          ]
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

function findCandidate(detail: MealPollDetail, recipeVersionId: UUID) {
  return detail.candidates.find(item => item.recipeVersionId === recipeVersionId) ?? null;
}

function findMenuItem(event: DiningEventSummary, recipeVersionId: UUID) {
  return event.menuItems.find(item => item.recipeVersionId === recipeVersionId) ?? null;
}

function findResponse(detail: MealPollDetail, userUid: number) {
  return detail.responses.find(item => item.userUid === userUid) ?? null;
}

function assertActivityKinds(activities: DiningGroupActivitySummary[], expectedKinds: DiningGroupActivityKind[]) {
  for (const kind of expectedKinds) {
    assert(activities.some(item => item.kind === kind), `activity list should include ${kind}`);
  }
}

async function main() {
  const owner = await login(ownerPhone);
  const member = await login(memberPhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };

  const ownerGroups = await requestData<GetMyDiningGroupsResponse>("/dining-groups", { headers: ownerAuth });
  const ownerGroup = ownerGroups.items.find(item => item.isOwned);
  assert(ownerGroup, "owner should have an owned dining group");
  await ensureMemberJoinedOwnerGroup(ownerAuth, memberAuth, ownerGroup.id);

  const ingredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: ownerAuth
  });
  const systemIngredient = ingredients.items[0];
  assert(systemIngredient, "system ingredient should be readable");

  const ownerRecipe = await createPublishedRecipe(ownerAuth, systemIngredient, "征集主理人");
  const memberRecipe = await createPublishedRecipe(memberAuth, systemIngredient, "征集成员");

  const pollListBefore = await requestData<MealPollSummary[]>(
    `/meal-polls?diningGroupId=${ownerGroup.id}&status=OPEN&mealSlot=DINNER&limit=20`,
    { headers: ownerAuth }
  );
  const planDate = findAvailablePollDate(pollListBefore, "DINNER");
  const deadlineAt = `${planDate}T10:00:00.000Z`;
  const scheduledAt = `${planDate}T11:30:00.000Z`;

  await requestData<unknown>("/meal-polls", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      diningGroupId: ownerGroup.id,
      planDate,
      mealSlot: "DINNER",
      deadlineAt,
      choiceLimit: 2,
      note: "周末晚饭征集",
      candidateRecipeVersionIds: [ownerRecipe.contentVersionId, memberRecipe.contentVersionId]
    })
  });

  const pollListAfterCreate = await requestData<MealPollSummary[]>(
    `/meal-polls?diningGroupId=${ownerGroup.id}&status=OPEN&planDate=${planDate}&mealSlot=DINNER&limit=5`,
    { headers: ownerAuth }
  );
  const createdPoll = pollListAfterCreate.find(
    item => item.diningGroupId === ownerGroup.id && item.planDate === planDate && item.mealSlot === "DINNER"
  );
  assert(createdPoll, "created meal poll should be returned by meal poll list");

  let pollDetail = await requestData<MealPollDetail>(`/meal-polls/${createdPoll.id}`, {
    headers: ownerAuth
  });
  const ownerCandidate = findCandidate(pollDetail, ownerRecipe.contentVersionId);
  const memberCandidate = findCandidate(pollDetail, memberRecipe.contentVersionId);
  assert(ownerCandidate, "poll detail should expose owner candidate recipeVersionId");
  assert(memberCandidate, "poll detail should expose member candidate recipeVersionId");
  assert(pollDetail.choiceLimit === 2, "poll detail should freeze choice limit");

  await requestData<unknown>(`/meal-polls/${createdPoll.id}/vote`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      expectedVersion: pollDetail.version,
      selectedCandidateIds: [memberCandidate.id],
      suggestionTitle: "加一道青菜",
      note: "这道我想做"
    })
  });

  pollDetail = await requestData<MealPollDetail>(`/meal-polls/${createdPoll.id}`, {
    headers: ownerAuth
  });
  let memberResponse = findResponse(pollDetail, member.user.uid);
  assert(memberResponse, "member vote should appear in poll detail");
  assert(memberResponse.selectedCandidateIds.length === 1, "member vote should keep one selected candidate");
  assert(memberResponse.selectedCandidateIds[0] === memberCandidate.id, "member vote should keep selected candidate id");
  assert(memberResponse.note === "这道我想做", "member vote should persist note");

  await requestData<unknown>(`/meal-polls/${createdPoll.id}/vote`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      expectedVersion: pollDetail.version,
      selectedCandidateIds: [memberCandidate.id],
      suggestionTitle: "加一道青菜",
      note: "重复提交后应覆盖旧备注"
    })
  });

  pollDetail = await requestData<MealPollDetail>(`/meal-polls/${createdPoll.id}`, {
    headers: ownerAuth
  });
  const memberResponses = pollDetail.responses.filter(item => item.userUid === member.user.uid);
  assert(memberResponses.length === 1, "member repeated vote should overwrite prior response instead of duplicating");
  memberResponse = memberResponses[0];
  assert(memberResponse.note === "重复提交后应覆盖旧备注", "member repeated vote should overwrite response note");

  await requestData<unknown>(`/meal-polls/${createdPoll.id}/vote`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      expectedVersion: pollDetail.version,
      selectedCandidateIds: [ownerCandidate.id],
      suggestionTitle: null,
      note: "我负责这道"
    })
  });

  pollDetail = await requestData<MealPollDetail>(`/meal-polls/${createdPoll.id}`, {
    headers: ownerAuth
  });
  assert(pollDetail.responseCount >= 2, "owner and member votes should both contribute to response count");

  await requestData<unknown>(`/meal-polls/${createdPoll.id}/confirm`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      expectedVersion: pollDetail.version,
      finalRecipeVersionIds: [ownerRecipe.contentVersionId, memberRecipe.contentVersionId],
      scheduledAt,
      location: "家里"
    })
  });

  pollDetail = await requestData<MealPollDetail>(`/meal-polls/${createdPoll.id}`, {
    headers: ownerAuth
  });
  assert(pollDetail.status === "CONFIRMED", "confirmed poll should enter CONFIRMED status");
  assert(pollDetail.confirmedPlanItemId, "confirmed poll should link generated meal plan item");
  assert(pollDetail.confirmedDiningEventId, "confirmed poll should link generated dining event");

  const ownerPlans = await requestData<PageResult<MealPlanSummary>>("/meal-plans?page=1&pageSize=100", {
    headers: ownerAuth
  });
  const memberPlans = await requestData<PageResult<MealPlanSummary>>("/meal-plans?page=1&pageSize=100", {
    headers: memberAuth
  });
  assert(
    ownerPlans.items.some(item => item.id === pollDetail.confirmedPlanItemId),
    "confirmed meal plan should belong to poll creator and be visible to owner"
  );
  assert(
    !memberPlans.items.some(item => item.id === pollDetail.confirmedPlanItemId),
    "confirmed meal plan should not be visible from member personal meal plans"
  );

  let eventDetail = await requestData<DiningEventSummary>(`/dining-events/${pollDetail.confirmedDiningEventId}`, {
    headers: ownerAuth
  });
  assert(eventDetail.planItemId === pollDetail.confirmedPlanItemId, "dining event should link back to confirmed meal plan");
  assert(eventDetail.menuItems.length === 2, "confirmed event should expose menuItems for final menu");

  const ownerMenuItem = findMenuItem(eventDetail, ownerRecipe.contentVersionId);
  const memberMenuItem = findMenuItem(eventDetail, memberRecipe.contentVersionId);
  assert(ownerMenuItem, "event should include owner recipe menu item");
  assert(memberMenuItem, "event should include member recipe menu item");

  const activitiesAfterConfirm = await requestData<DiningGroupActivitySummary[]>(
    `/dining-group-activities?diningGroupId=${ownerGroup.id}&limit=5`,
    { headers: ownerAuth }
  );
  assertActivityKinds(activitiesAfterConfirm, ["POLL_OPENED", "POLL_VOTED", "MENU_CONFIRMED"]);

  await requestData<unknown>(`/dining-events/${eventDetail.id}/cook`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      expectedVersion: memberMenuItem.version,
      menuItemId: memberMenuItem.id,
      action: "CLAIM"
    })
  });

  eventDetail = await requestData<DiningEventSummary>(`/dining-events/${pollDetail.confirmedDiningEventId}`, {
    headers: memberAuth
  });
  const claimedMenuItem = findMenuItem(eventDetail, memberRecipe.contentVersionId);
  assert(claimedMenuItem, "claimed menu item should remain readable after claim");
  assert(claimedMenuItem.cookUserUid === member.user.uid, "claim cook should bind cookUserUid to current member");

  await requestStatus<unknown>(`/dining-events/${eventDetail.id}/cook`, 409, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      expectedVersion: memberMenuItem.version,
      menuItemId: memberMenuItem.id,
      action: "CLAIM"
    })
  });

  await requestData<unknown>(`/dining-events/${eventDetail.id}/cook`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      expectedVersion: claimedMenuItem.version,
      menuItemId: claimedMenuItem.id,
      action: "RELEASE"
    })
  });

  eventDetail = await requestData<DiningEventSummary>(`/dining-events/${pollDetail.confirmedDiningEventId}`, {
    headers: ownerAuth
  });
  const releasedMenuItem = findMenuItem(eventDetail, memberRecipe.contentVersionId);
  assert(releasedMenuItem, "released menu item should remain readable after release");
  assert(releasedMenuItem.cookUserUid === null, "release should clear cookUserUid");

  const activitiesAfterCook = await requestData<DiningGroupActivitySummary[]>(
    `/dining-group-activities?diningGroupId=${ownerGroup.id}&limit=5`,
    { headers: ownerAuth }
  );
  assertActivityKinds(activitiesAfterCook, ["MENU_CONFIRMED", "COOK_CLAIMED"]);

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        pollId: createdPoll.id,
        planDate,
        confirmedPlanItemId: pollDetail.confirmedPlanItemId,
        confirmedDiningEventId: pollDetail.confirmedDiningEventId,
        ownerRecipeVersionId: ownerRecipe.contentVersionId,
        memberRecipeVersionId: memberRecipe.contentVersionId,
        claimedMenuItemId: memberMenuItem.id
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
