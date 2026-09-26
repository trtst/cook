const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

jest.setTimeout(30000);

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
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
      response => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({ status: response.statusCode || 0, body: JSON.parse(rawBody || "null") });
          } catch {
            reject(new Error(`invalid json response from ${path}: ${rawBody}`));
          }
        });
      }
    );
    requestTask.on("error", reject);
    if (options.body) requestTask.write(options.body);
    requestTask.end();
  });
}

async function requestData(path, options = {}) {
  const result = await request(path, options);
  expect(result.status).toBeGreaterThanOrEqual(200);
  expect(result.status).toBeLessThan(300);
  expect(result.body.code).toBe(0);
  return result.body.data;
}

describe("低维护食材参考页 API", () => {
  let authHeaders;
  let ingredient;

  beforeAll(async () => {
    const session = await loginWithPassword(createFreshPhone());
    authHeaders = { authorization: `Bearer ${session.token}` };
    const result = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", { headers: authHeaders });
    ingredient = result.items[0];
  });

  it("勾选或手动标记只留下近期食材痕迹，不要求库存数量", async () => {
    const headers = {
      ...authHeaders,
      "Idempotency-Key": nextIdempotencyKey()
    };
    await requestData("/fridge-traces/present", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ingredientId: ingredient.id,
        name: ingredient.name,
        categoryName: "蔬菜"
      })
    });

    const result = await requestData("/fridge-traces?page=1&pageSize=20", { headers: authHeaders });
    const trace = result.items.find(item => item.ingredientId === ingredient.id);
    expect(trace).toEqual(expect.objectContaining({
      name: ingredient.name,
      kind: "MANUAL_PRESENT",
      windowDays: 7
    }));
    expect(trace).not.toHaveProperty("quantityText");
    expect(trace).not.toHaveProperty("expireAt");

    await requestData("/fridge-traces/empty", {
      method: "POST",
      headers: { ...authHeaders, "Idempotency-Key": nextIdempotencyKey() },
      body: JSON.stringify({ ingredientId: ingredient.id, name: ingredient.name })
    });
  });
});
