const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";
const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const WEEKDAY_NAMES = {
  MONDAY: "周一",
  TUESDAY: "周二",
  WEDNESDAY: "周三",
  THURSDAY: "周四",
  FRIDAY: "周五",
  SATURDAY: "周六",
  SUNDAY: "周日"
};

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function beijingToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function weekdayForDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAYS[(dayIndex + 6) % 7];
}

function visibleDay(topic) {
  const available = new Set(topic.items.map((item) => item.weekday));
  const today = beijingToday();
  const expected = today >= topic.periodStartDate && today <= topic.periodEndDate
    ? weekdayForDate(today)
    : "MONDAY";
  const weekday = available.has(expected)
    ? expected
    : available.has("MONDAY")
      ? "MONDAY"
      : WEEKDAYS.find((item) => available.has(item));
  return {
    weekday,
    recipeTitles: topic.items.filter((item) => item.weekday === weekday).map((item) => item.title)
  };
}

async function collectTexts(page) {
  const nodes = await page.$$(`text`);
  const texts = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) texts.push(value);
  }

  return texts;
}

async function request(path, options = {}, admin = false) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
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
          ...(options.headers || {})
        }
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode || 0,
              body: JSON.parse(rawBody || "null")
            });
          } catch {
            reject(new Error(`invalid json response from ${path}: ${rawBody}`));
          }
        });
      }
    );

    requestTask.on("error", reject);

    if (options.body) {
      requestTask.write(options.body);
    }

    requestTask.end();
  });
}

async function requestData(path, options = {}, admin = false) {
  const result = await request(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

async function loginAdmin() {
  const result = await requestData(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      })
    },
    true
  );
  return result.token;
}

async function createTopicFixture() {
  const publicCurrent = await requestData("/home-topics/current");
  if (publicCurrent.topic?.items?.length) {
    const day = visibleDay(publicCurrent.topic);
    return {
      topicId: publicCurrent.topic.id,
      title: publicCurrent.topic.title,
      previousTitle: publicCurrent.topic.history[0]?.title ?? null,
      hasHistory: publicCurrent.topic.history.length > 0,
      weekday: day.weekday,
      recipeTitles: day.recipeTitles,
      visibleWeekdayCount: new Set(publicCurrent.topic.items.map((item) => item.weekday)).size
    };
  }

  const adminToken = await loginAdmin();
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`
  };
  const topics = await requestData("/admin/home-topics", { headers: adminHeaders }, true);
  const recipes = await requestData("/admin/home-topics/recipes", { headers: adminHeaders }, true);
  assert(recipes.items.length >= 7, "weekly topic fixture needs seven publicly available inspiration recipes");

  const issueBase = Math.max(0, ...topics.topics.map((item) => item.issueNo)) + 1;
  const suffix = `${Date.now()}`.slice(-6);
  const currentTitle = `本周灵感当前验收-${suffix}`;
  const recipeIds = recipes.items.slice(0, 7).map((item) => item.id);
  const weekdays = WEEKDAYS;

  const currentResult = await requestData(
    "/admin/home-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title: currentTitle,
        subTitle: "用于验证本期推荐",
        recType: "HOME_STYLE",
        issueNo: issueBase,
        description: "当前专题测试数据",
        items: recipeIds.map((recipeId, index) => ({
          recipeId,
          weekday: weekdays[index],
          sortOrder: 1,
          recommendNote: `当前推荐 ${index + 1}`
        }))
      })
    },
    true
  );
  const currentTopic = currentResult.topics.find((item) => item.title === currentTitle);
  assert(currentTopic, "failed to create current weekly topic fixture");

  await requestData(
    `/admin/home-topics/${currentTopic.id}/status`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        status: "PUBLISHED",
        expectedVersion: currentTopic.version
      })
    },
    true
  );

  const day = visibleDay(currentTopic);
  const previousTitle = topics.topics.find((item) => item.status === "PUBLISHED" && item.periodStartDate < currentTopic.periodStartDate)?.title ?? null;

  return {
    topicId: currentTopic.id,
    title: currentTitle,
    previousTitle,
    hasHistory: Boolean(previousTitle),
    weekday: day.weekday,
    recipeTitles: day.recipeTitles,
    visibleWeekdayCount: new Set(currentTopic.items.map((item) => item.weekday)).size
  };
}

describe("pages_home/topic/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createTopicFixture();
    page = await program.reLaunch(`/pages_home/topic/index?topicId=${fixture.topicId}`);
    await page.waitFor(".topic-summary__title", 8000);
  });

  it("共享周刊页展示选中日菜单及存在时的往期内容", async () => {
    expect(await page.path).toBe("pages_home/topic/index");

    const texts = await collectTexts(page);
    expect(texts).toContain(fixture.title);
    expect(texts).toContain("本期菜单");
    expect(texts).toContain("加入计划");
    if (fixture.hasHistory) {
      expect(texts).toContain("往期回顾");
      expect(texts).toContain(fixture.previousTitle);
    }
    if (fixture.visibleWeekdayCount > 1) expect(texts).toContain(WEEKDAY_NAMES[fixture.weekday]);
    expect(fixture.recipeTitles.length).toBeGreaterThan(0);
    fixture.recipeTitles.forEach((title) => {
      expect(texts).toContain(title);
    });
  });
});
