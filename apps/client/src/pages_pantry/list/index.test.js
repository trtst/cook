const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_CODE = "123456";

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function collectTexts(nodes) {
  const values = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) values.push(value);
  }

  return values;
}

async function request(path, options = {}) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: {
          "content-type": "application/json",
          "x-cook-from": "mini_program",
          "x-cook-version": "0.1.0",
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

async function requestData(path, options = {}) {
  const result = await request(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

async function loginWithCode(phone) {
  return requestData("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: TEST_CODE
    })
  });
}

async function resolveSystemIngredient(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  assert(ingredients.items && ingredients.items.length > 0, "missing system ingredient fixture");
  return ingredients.items[0];
}

async function createShoppingListFixture(authHeaders) {
  const ingredient = await resolveSystemIngredient(authHeaders);
  const listName = `采购列表验收清单${nextIdempotencyKey().slice(-6)}`;
  const created = await requestData("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: listName
    })
  });
  const updated = await requestData(`/shopping-lists/${created.id}/items`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: ingredient.name,
      ingredientId: ingredient.id,
      quantityText: `2${ingredient.defaultUnit.name}`,
      note: "采购列表自动化验收食材"
    })
  });
  return {
    listId: updated.id,
    listName
  };
}

describe("pages_pantry/list/index", () => {
  let page;
  let session;
  let fixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    const authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    fixture = await createShoppingListFixture(authHeaders);

    await clearSession();
    page = await program.reLaunch("/pages_pantry/list/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".list-card__title", 8000);
  });

  it("采购清单页可以完成真实登录并展示清单列表主状态", async () => {
    expect(await page.path).toBe("pages_pantry/list/index");

    const tabTexts = await collectTexts(await page.$$(".nav-tabs__item"));
    expect(tabTexts).toEqual(["采购中", "已完成", "已作废"]);

    const texts = await collectTexts(await page.$$(`text`));
    expect(texts).toContain(fixture.listName);
    expect(texts).toContain("采购进度");
    expect(texts).toContain("0/1");
    expect(texts).toContain("协作人数");
    expect(texts).toContain("加入方式");
    expect(texts).toContain("关闭分享");
  });
});
