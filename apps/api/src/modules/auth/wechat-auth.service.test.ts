import assert from "node:assert/strict";
import test from "node:test";
import { WechatAuthService } from "./wechat-auth.service";

const originalAppId = process.env.WECHAT_APP_ID;
const originalAppSecret = process.env.WECHAT_APP_SECRET;

test.afterEach(() => {
  if (originalAppId === undefined) delete process.env.WECHAT_APP_ID;
  else process.env.WECHAT_APP_ID = originalAppId;
  if (originalAppSecret === undefined) delete process.env.WECHAT_APP_SECRET;
  else process.env.WECHAT_APP_SECRET = originalAppSecret;
});

test("exchanges wx.login code and phone component code without exposing session secrets", async () => {
  process.env.WECHAT_APP_ID = "wx-app-id";
  process.env.WECHAT_APP_SECRET = "wx-app-secret";
  const calls: Array<{ url: string; body?: string }> = [];
  const service = new WechatAuthService(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
    if (url.includes("jscode2session")) {
      return new Response(JSON.stringify({ openid: "openid-a", unionid: "unionid-a", session_key: "session-key-a" }));
    }
    if (url.includes("cgi-bin/token")) {
      return new Response(JSON.stringify({ access_token: "access-token-a", expires_in: 7200 }));
    }
    return new Response(JSON.stringify({ phone_info: { phoneNumber: "13800000000" } }));
  });

  const identity = await service.login("wx-code");
  const phone = await service.getPhoneNumber("phone-code");

  assert.deepEqual(identity, {
    appid: "wx-app-id",
    openid: "openid-a",
    unionid: "unionid-a",
    sessionKey: "session-key-a"
  });
  assert.equal(phone.phone, "13800000000");
  assert.equal(calls.length, 3);
  assert.ok(calls[2].body?.includes('"code":"phone-code"'));
  assert.ok(!calls[2].body?.includes("session-key-a"));
});

test("rejects missing WeChat configuration before making a network request", async () => {
  delete process.env.WECHAT_APP_ID;
  delete process.env.WECHAT_APP_SECRET;
  let called = false;
  const service = new WechatAuthService(async () => {
    called = true;
    return new Response("{}");
  });

  await assert.rejects(() => service.login("wx-code"), { message: "微信登录暂不可用" });
  assert.equal(called, false);
});
