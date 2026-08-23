const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
          } catch (error) {
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
  const adminToken = await loginAdmin();
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`
  };
  const topics = await requestData("/admin/home-topics", { headers: adminHeaders }, true);
  const recipes = await requestData("/admin/home-topics/recipes", { headers: adminHeaders }, true);
  assert(recipes.items.length >= 3, "missing inspiration recipes for weekly topic fixture");

  const issueBase = Math.max(0, ...topics.topics.map((item) => item.issueNo)) + 1;
  const suffix = `${Date.now()}`.slice(-6);
  const previousTitle = `本周灵感往期验收-${suffix}`;
  const currentTitle = `本周灵感当前验收-${suffix}`;
  const recipeIds = recipes.items.slice(0, 3).map((item) => item.id);
  const recipeTitles = recipes.items.slice(0, 3).map((item) => item.title);

  const previousResult = await requestData(
    "/admin/home-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title: previousTitle,
        subTitle: "用于验证往期回顾",
        recType: "HOME_STYLE",
        issueNo: issueBase,
        description: "往期专题测试数据",
        items: recipeIds.map((recipeId, index) => ({
          recipeId,
          recommendNote: `往期推荐 ${index + 1}`
        }))
      })
    },
    true
  );
  const previousTopic = previousResult.topics.find((item) => item.title === previousTitle);
  assert(previousTopic, "failed to create previous weekly topic fixture");

  await requestData(
    `/admin/home-topics/${previousTopic.id}/status`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        status: "LISTED",
        expectedVersion: previousTopic.version
      })
    },
    true
  );

  await new Promise((resolve) => setTimeout(resolve, 20));

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
        issueNo: issueBase + 1,
        description: "当前专题测试数据",
        items: recipeIds.map((recipeId, index) => ({
          recipeId,
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
        status: "LISTED",
        expectedVersion: currentTopic.version
      })
    },
    true
  );

  return {
    topicId: currentTopic.id,
    title: currentTitle,
    previousTitle,
    recipeTitles
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

  it("本周灵感专题页可以展示本期推荐与往期回顾主状态", async () => {
    expect(await page.path).toBe("pages_home/topic/index");

    const texts = await collectTexts(page);
    expect(texts).toContain(fixture.title);
    expect(texts).toContain("本期推荐");
    expect(texts).toContain("往期回顾");
    expect(texts).toContain("加入计划");
    expect(texts).toContain(fixture.previousTitle);
    fixture.recipeTitles.forEach((title) => {
      expect(texts).toContain(title);
    });
  });
});
