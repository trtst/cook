import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { WechatMiniCodeService } from "./wechat-mini-code.service";

const originalFetch = global.fetch;
const originalAppId = process.env.WECHAT_APP_ID;
const originalAppSecret = process.env.WECHAT_APP_SECRET;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalAppId === undefined) delete process.env.WECHAT_APP_ID;
  else process.env.WECHAT_APP_ID = originalAppId;
  if (originalAppSecret === undefined) delete process.env.WECHAT_APP_SECRET;
  else process.env.WECHAT_APP_SECRET = originalAppSecret;
});

test("memory share mini code opens the existing memory page with the share token as scene", async () => {
  process.env.WECHAT_APP_ID = "wx-app-id";
  process.env.WECHAT_APP_SECRET = "wx-app-secret";
  const requests: Array<{ url: string; body: string | null }> = [];
  global.fetch = (async (input, init) => {
    requests.push({ url: String(input), body: typeof init?.body === "string" ? init.body : null });
    if (requests.length === 1) {
      return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
      status: 200,
      headers: { "content-type": "image/png" }
    });
  }) as typeof fetch;

  const buffer = await new WechatMiniCodeService().createMemoryShareCode("12345678901234567890123456789012");

  assert.deepEqual([...buffer], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(JSON.parse(requests[1]?.body || "{}"), {
    scene: "12345678901234567890123456789012",
    page: "pages_share/memory/index",
    check_path: false,
    env_version: "release",
    width: 430
  });
});

test("memory share mini code rejects a scene longer than WeChat allows", async () => {
  await assert.rejects(
    () => new WechatMiniCodeService().createMemoryShareCode("123456789012345678901234567890123"),
    /分享标识无效/
  );
});

test("memory share mini code rejects a non-PNG success response", async () => {
  process.env.WECHAT_APP_ID = "wx-app-id";
  process.env.WECHAT_APP_SECRET = "wx-app-secret";
  let requestCount = 0;
  global.fetch = (async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(Buffer.from("not-a-png"), {
      status: 200,
      headers: { "content-type": "image/png" }
    });
  }) as typeof fetch;

  await assert.rejects(
    () => new WechatMiniCodeService().createMemoryShareCode("12345678901234567890123456789012"),
    /小程序码生成失败/
  );
});

test("memory share mini code maps a binary body read failure to an unavailable response", async () => {
  process.env.WECHAT_APP_ID = "wx-app-id";
  process.env.WECHAT_APP_SECRET = "wx-app-secret";
  let requestCount = 0;
  global.fetch = (async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return {
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => {
        throw new Error("body unavailable");
      }
    } as unknown as Response;
  }) as typeof fetch;

  await assert.rejects(
    () => new WechatMiniCodeService().createMemoryShareCode("12345678901234567890123456789012"),
    /小程序码生成失败/
  );
});

test("memory share mini code maps a malformed access token response to unavailable", async () => {
  process.env.WECHAT_APP_ID = "wx-app-id";
  process.env.WECHAT_APP_SECRET = "wx-app-secret";
  global.fetch = (async () => new Response("not-json", {
    status: 200,
    headers: { "content-type": "application/json" }
  })) as typeof fetch;

  await assert.rejects(
    () => new WechatMiniCodeService().createMemoryShareCode("12345678901234567890123456789012"),
    /小程序码暂不可用/
  );
});
