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

async function collectTexts(nodes) {
  const values = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) values.push(value);
  }

  return values;
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
  const suffix = `${Date.now()}`.slice(-6);
  const previousTitle = `餐桌话题往期验收-${suffix}`;
  const currentTitle = `餐桌话题本期验收-${suffix}`;

  const previousResult = await requestData(
    "/admin/table-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title: previousTitle,
        summary: "用于验证餐桌话题往期卡片。",
        activityAt: createIso(24),
        targetType: "PAGE",
        targetValue: null
      })
    },
    true
  );
  const previousTopic = previousResult.topics.find((item) => item.title === previousTitle);
  assert(previousTopic, "failed to create previous table topic fixture");

  await requestData(
    `/admin/table-topics/${previousTopic.id}/status`,
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
    "/admin/table-topics",
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        title: currentTitle,
        summary: "用于验证餐桌话题最新卡片。",
        activityAt: createIso(48),
        targetType: "PAGE",
        targetValue: "/pages/home/index"
      })
    },
    true
  );
  const currentTopic = currentResult.topics.find((item) => item.title === currentTitle);
  assert(currentTopic, "failed to create current table topic fixture");

  await requestData(
    `/admin/table-topics/${currentTopic.id}/status`,
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
    currentTitle,
    previousTitle
  };
}

describe("pages_home/table-topic/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createTopicFixture();
    page = await program.reLaunch("/pages_home/table-topic/index");
    await page.waitFor(".topic-card__title", 8000);
  });

  it("餐桌话题列表页可以展示最新和往期话题主状态", async () => {
    expect(await page.path).toBe("pages_home/table-topic/index");

    const titleNodes = await page.$$(".topic-card__title");
    const titles = await collectTexts(titleNodes);
    expect(titles[0]).toBe(fixture.currentTitle);
    expect(titles).toContain(fixture.previousTitle);

    const texts = await collectTexts(await page.$$(`text`));
    expect(texts).toContain("历次话题");
    expect(texts).toContain("从最近一顿饭开始看");
    expect(texts).toContain("每次一个新话题，按时间倒序收在这里。点进详情后可以直接参与。");
    expect(texts).toContain("0 人参与");
  });
});
