import assert from "node:assert/strict";
import test from "node:test";
import { uniPlatform } from "@/platform/uni";
import { restoreWechatSession } from "./wechat-session";

test("restores an unbound WeChat identity into a pending phone-auth session", async () => {
  const storageGet = uniPlatform.storage.get;
  const authLogin = uniPlatform.auth.login;
  const getDeviceId = uniPlatform.auth.getDeviceId;
  const getRuntimeChannel = uniPlatform.system.getRuntimeChannel;
  const store = {
    logoutExplicit: false,
    wechatSessionId: "",
    status: "guest",
    setWechatSessionId(id: string) {
      this.wechatSessionId = id;
    },
    markBlocked() {
      this.status = "blocked";
    },
    setSession: async () => undefined
  };

  uniPlatform.storage.get = async () => null;
  uniPlatform.system.getRuntimeChannel = () => "mini_program";
  uniPlatform.auth.login = async () => ({ code: "login-code" });
  uniPlatform.auth.getDeviceId = () => "device-a";

  try {
    await restoreWechatSession(store, {
      wechatSession: async (body) => {
        assert.equal(body.code, "login-code");
        assert.equal(body.deviceId, "device-a");
        return {
          status: "UNBOUND",
          session: null,
          wechatSessionId: "pending-wechat-session",
          retryAfterSeconds: null
        };
      }
    });
    assert.equal(store.wechatSessionId, "pending-wechat-session");
    assert.equal(store.status, "guest");
  } finally {
    uniPlatform.storage.get = storageGet;
    uniPlatform.auth.login = authLogin;
    uniPlatform.auth.getDeviceId = getDeviceId;
    uniPlatform.system.getRuntimeChannel = getRuntimeChannel;
  }
});
