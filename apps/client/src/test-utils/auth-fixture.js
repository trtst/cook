const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "change-me";

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function buildHeaders(admin, extra = {}) {
  return {
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
    ...extra
  };
}

async function request(path, options = {}, admin = false) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: buildHeaders(admin, options.headers || {})
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
          } catch (_error) {
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

async function requestData(path, options = {}, admin = false) {
  const result = await request(path, options, admin);
  if (result.status < 200 || result.status >= 300 || result.body.code !== 0) {
    throw new Error(`${path} HTTP ${result.status}: ${result.body.message}`);
  }
  return result.body.data;
}

async function loginWithPassword(phone) {
  const adminSession = await requestData(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    },
    true
  );
  await requestData(
    "/admin/users",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminSession.token}`,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        phone,
        password: TEST_PASSWORD,
        nickname: `自动化用户${phone.slice(-6)}`
      })
    },
    true
  );

  return requestData("/auth/password/login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      password: TEST_PASSWORD,
      deviceId: `hbuilderx-${phone}-${nextIdempotencyKey()}`
    })
  });
}

module.exports = { loginWithPassword };
