import { loadLocalEnv } from "../src/common/load-env";
import type {
  AdminTableTopicItem,
  AdminTableTopicsResponse,
  HomeEntriesResponse,
  TableTopicDetailResponse,
  TableTopicListResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const testCode = process.env.TEST_LOGIN_CODE ?? "123456";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
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

function createFreshPhone() {
  const suffix = nextIdempotencyKey().slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function createIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
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
  const result = await requestData<LoginResult>(
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

async function loginWithCode(phone: string) {
  return requestData<LoginResult>("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({ phone, code: testCode })
  });
}

async function listTopics(adminHeaders: Record<string, string>) {
  return requestData<AdminTableTopicsResponse>("/admin/table-topics", { headers: adminHeaders }, true);
}

async function createTopic(
  adminHeaders: Record<string, string>,
  input: {
    title: string;
    summary: string;
    activityAt: string;
    targetType: "PAGE" | "WEB_VIEW";
    targetValue: string | null;
  }
) {
  return requestData<AdminTableTopicsResponse>(
    "/admin/table-topics",
    {
      method: "POST",
      headers: withIdempotencyKey(adminHeaders),
      body: JSON.stringify(input)
    },
    true
  );
}

async function setTopicStatus(adminHeaders: Record<string, string>, topic: AdminTableTopicItem, status: "LISTED" | "UNLISTED") {
  return requestData<AdminTableTopicItem>(
    `/admin/table-topics/${topic.id}/status`,
    {
      method: "POST",
      headers: withIdempotencyKey(adminHeaders),
      body: JSON.stringify({
        status,
        expectedVersion: topic.version
      })
    },
    true
  );
}

function findTopic(topics: AdminTableTopicItem[], title: string) {
  const topic = topics.find(item => item.title === title) ?? null;
  assert(topic, `missing topic ${title}`);
  return topic;
}

async function main() {
  const adminToken = await loginAdmin();
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`
  };
  const userLogin = await loginWithCode(createFreshPhone());
  const userHeaders = {
    authorization: `Bearer ${userLogin.token}`
  };
  const suffix = nextIdempotencyKey().slice(-6);
  const previousTitle = `餐桌话题往期验收-${suffix}`;
  const currentTitle = `餐桌话题本期验收-${suffix}`;

  const previousResult = await createTopic(adminHeaders, {
    title: previousTitle,
    summary: "用于验证餐桌话题列表倒序和详情读取。",
    activityAt: createIso(24),
    targetType: "PAGE",
    targetValue: null
  });
  const previousTopic = findTopic(previousResult.topics, previousTitle);
  const listedPrevious = await setTopicStatus(adminHeaders, previousTopic, "LISTED");

  await new Promise(resolve => setTimeout(resolve, 20));

  const currentResult = await createTopic(adminHeaders, {
    title: currentTitle,
    summary: "用于验证餐桌话题参与、去重和首页入口。",
    activityAt: createIso(48),
    targetType: "PAGE",
    targetValue: "/pages/home/index"
  });
  const currentTopic = findTopic(currentResult.topics, currentTitle);
  const listedCurrent = await setTopicStatus(adminHeaders, currentTopic, "LISTED");

  const topicList = await requestData<TableTopicListResponse>("/table-topics");
  assert(topicList.items.length >= 2, "table topic list should contain the created fixtures");
  assert(topicList.items[0]?.id === listedCurrent.id, `latest listed topic should be first, got ${topicList.items[0]?.id}`);
  assert(topicList.items[1]?.id === listedPrevious.id, `previous listed topic should be second, got ${topicList.items[1]?.id}`);

  const anonymousDetail = await requestData<TableTopicDetailResponse>(`/table-topics/${listedCurrent.id}`);
  assert(anonymousDetail.topic.id === listedCurrent.id, "anonymous detail id mismatch");
  assert(anonymousDetail.topic.title === currentTitle, "anonymous detail title mismatch");
  assert(anonymousDetail.topic.summary === "用于验证餐桌话题参与、去重和首页入口。", "anonymous detail summary mismatch");
  assert(anonymousDetail.topic.joined === false, "anonymous detail should not show joined");
  assert(anonymousDetail.topic.targetValue === "/pages/home/index", "anonymous detail target mismatch");

  const userDetailBefore = await requestData<TableTopicDetailResponse>(`/table-topics/${listedCurrent.id}`, {
    headers: userHeaders
  });
  assert(userDetailBefore.topic.joined === false, "fresh user should not join before participation");

  const participateOperationId = nextIdempotencyKey();
  const joined = await requestData<TableTopicDetailResponse>(
    `/table-topics/${listedCurrent.id}/participate`,
    {
      method: "POST",
      headers: withIdempotencyKey(userHeaders, participateOperationId)
    }
  );
  assert(joined.topic.joined === true, "participate should return joined=true");
  assert(
    joined.topic.participantCount === userDetailBefore.topic.participantCount + 1,
    `participant count should increment once, got ${joined.topic.participantCount}`
  );

  const joinedReplay = await requestData<TableTopicDetailResponse>(
    `/table-topics/${listedCurrent.id}/participate`,
    {
      method: "POST",
      headers: withIdempotencyKey(userHeaders, participateOperationId)
    }
  );
  assert(joinedReplay.topic.participantCount === joined.topic.participantCount, "same operation id should stay idempotent");

  const joinedDuplicate = await requestData<TableTopicDetailResponse>(
    `/table-topics/${listedCurrent.id}/participate`,
    {
      method: "POST",
      headers: withIdempotencyKey(userHeaders)
    }
  );
  assert(joinedDuplicate.topic.participantCount === joined.topic.participantCount, "same user should not be counted twice");

  const userDetailAfter = await requestData<TableTopicDetailResponse>(`/table-topics/${listedCurrent.id}`, {
    headers: userHeaders
  });
  assert(userDetailAfter.topic.joined === true, "user detail should show joined=true after participation");
  assert(userDetailAfter.topic.participantCount === joined.topic.participantCount, "detail count should stay in sync after participation");

  const homeEntries = await requestData<HomeEntriesResponse>("/home-entries");
  const tableTopicEntry = homeEntries.items.find(item => item.title === "餐桌话题") ?? null;
  assert(tableTopicEntry, "home entries should include table topic");
  assert(tableTopicEntry.targetType === "PAGE", "table topic entry should stay as page target");
  assert(
    tableTopicEntry.targetValue === "/pages_home/table-topic/index",
    `table topic entry target mismatch: ${tableTopicEntry.targetValue}`
  );

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        listedCurrentTopicId: listedCurrent.id,
        listedCurrentTitle: currentTitle,
        listedPreviousTopicId: listedPrevious.id,
        listedPreviousTitle: previousTitle,
        orderedTitles: topicList.items.slice(0, 2).map(item => item.title),
        participantCountAfterJoin: joined.topic.participantCount,
        joinedAfterRead: userDetailAfter.topic.joined,
        homeEntryTarget: tableTopicEntry.targetValue
      },
      null,
      2
    )
  );
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
