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

function createIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function createTopicFixture() {
  const adminToken = await loginAdmin();
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`
  };
  const title = `餐桌话题详情验收-${`${Date.now()}`.slice(-6)}`;
  const summary = "用于验证餐桌话题详情正文、参与状态与活动详情入口。";

  const createResult = await requestData(
    "/admin/table-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title,
        summary,
        activityAt: createIso(36),
        targetType: "PAGE",
        targetValue: "/pages/home/index"
      })
    },
    true
  );
  const createdTopic = createResult.topics.find((item) => item.title === title);
  assert(createdTopic, "failed to create table topic detail fixture");

  const listedTopic = await requestData(
    `/admin/table-topics/${createdTopic.id}/status`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        status: "LISTED",
        expectedVersion: createdTopic.version
      })
    },
    true
  );

  return {
    topicId: listedTopic.id,
    title,
    summary
  };
}

describe("pages_home/table-topic-detail/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createTopicFixture();
    page = await program.reLaunch(`/pages_home/table-topic-detail/index?topicId=${fixture.topicId}`);
    await page.waitFor(".topic-panel__label", 8000);
  });

  it("餐桌话题详情页可以展示简介和参与主状态", async () => {
    expect(await page.path).toBe("pages_home/table-topic-detail/index");

    const texts = await collectTexts(page);
    const actionButton = await page.$(".topic-panel__button");
    const actionLink = await page.$(".topic-panel__link");

    expect(texts).toContain("餐桌话题");
    expect(texts).toContain(fixture.title);
    expect(texts).toContain("话题简介");
    expect(texts).toContain(fixture.summary);
    expect(texts).toContain("参与状态");
    expect(texts).toContain("还没参与");
    expect(texts).toContain("同一位用户只记一次参与，不支持取消。");
    expect((await actionButton.text()).trim()).toBe("点击参与");
    expect((await actionLink.text()).trim()).toBe("查看活动详情");
  });
});
