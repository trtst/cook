import { loadLocalEnv } from "../src/common/load-env";
import type {
  AdminHomeTopicItem,
  AdminHomeTopicsResponse,
  HomeTopicCurrentResponse,
  HomeTopicDetailResponse,
  HomeTopicRecipeSearchResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
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

async function loginAdmin() {
  const result = await requestData<{ token: string }>(
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
  return result.token;
}

async function listTopics(adminHeaders: Record<string, string>) {
  return requestData<AdminHomeTopicsResponse>("/admin/home-topics", { headers: adminHeaders }, true);
}

async function searchRecipes(adminHeaders: Record<string, string>) {
  return requestData<HomeTopicRecipeSearchResponse>("/admin/home-topics/recipes", { headers: adminHeaders }, true);
}

async function createTopic(
  adminHeaders: Record<string, string>,
  input: {
    title: string;
    subTitle: string;
    issueNo: number;
    description: string;
    recipeIds: number[];
  }
) {
  return requestData<AdminHomeTopicsResponse>(
    "/admin/home-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title: input.title,
        subTitle: input.subTitle,
        issueNo: input.issueNo,
        description: input.description,
        items: input.recipeIds.map((recipeId, index) => ({
          recipeId,
          weekday: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"][index],
          sortOrder: 1,
          recommendNote: `第 ${index + 1} 道推荐`
        }))
      })
    },
    true
  );
}

async function setTopicStatus(adminHeaders: Record<string, string>, topic: AdminHomeTopicItem, status: "DRAFT" | "PUBLISHED" | "UNLISTED") {
  return requestData<AdminHomeTopicItem>(
    `/admin/home-topics/${topic.id}/status`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        status,
        expectedVersion: topic.version
      })
    },
    true
  );
}

function findTopic(topics: AdminHomeTopicItem[], title: string) {
  const topic = topics.find(item => item.title === title) ?? null;
  assert(topic, `missing topic ${title}`);
  return topic;
}

async function main() {
  const adminToken = await loginAdmin();
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`
  };

  const existingCurrent = await requestData<HomeTopicCurrentResponse>("/home-topics/current");
  if (existingCurrent.topic) {
    const detail = await requestData<HomeTopicDetailResponse>(`/home-topics/${existingCurrent.topic.id}`);
    assert(detail.topic.id === existingCurrent.topic.id, "current topic detail id mismatch");
    assert(detail.topic.items.length > 0, "current topic should expose at least one publicly available recipe");
    console.log(JSON.stringify({ apiBaseUrl, currentTopicId: detail.topic.id, currentTitle: detail.topic.title, recipeTitles: detail.topic.items.map(item => item.title), historyTitles: existingCurrent.topic.history.map(item => item.title), readOnly: true }, null, 2));
    return;
  }

  const existing = await listTopics(adminHeaders);
  const recipes = await searchRecipes(adminHeaders);
  assert(recipes.items.length >= 7, "home weekly topics need at least 7 inspiration recipe fixtures");

  const issueBase = Math.max(0, ...existing.topics.map(item => item.issueNo)) + 1;
  const suffix = nextIdempotencyKey().slice(-6);
  const currentTitle = `本周灵感验收当前-${suffix}`;

  const currentResult = await createTopic(adminHeaders, {
    title: currentTitle,
    subTitle: "用于验证当前专题与首页入口",
    issueNo: issueBase,
    description: "当前专题应返回七日菜单，并能通过首页入口进入专题页。",
    recipeIds: recipes.items.slice(0, 7).map(item => item.id)
  });
  const currentTopic = findTopic(currentResult.topics, currentTitle);
  const listedCurrent = await setTopicStatus(adminHeaders, currentTopic, "PUBLISHED");

  const current = await requestData<HomeTopicCurrentResponse>("/home-topics/current");
  assert(current.topic, "current home topic should exist after listing");
  assert(current.topic.id === listedCurrent.id, `current topic should be ${listedCurrent.id}, got ${current.topic.id}`);
  assert(current.topic.title === currentTitle, `current topic title mismatch: ${current.topic.title}`);
  assert(new Set(current.topic.items.map(item => item.weekday)).size === 7, "current topic should expose a recipe for every weekday");

  const detail = await requestData<HomeTopicDetailResponse>(`/home-topics/${listedCurrent.id}`);
  assert(detail.topic.id === listedCurrent.id, "topic detail id mismatch");
  assert(detail.topic.title === currentTitle, "topic detail title mismatch");
  assert(detail.topic.items[0]?.title, "topic detail should expose recipe titles");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        listedCurrentTopicId: listedCurrent.id,
        listedCurrentTitle: currentTitle,
        recipeTitles: detail.topic.items.map(item => item.title),
        historyTitles: current.topic.history.map(item => item.title),
        homeEntryTarget: weeklyEntry.targetValue
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
