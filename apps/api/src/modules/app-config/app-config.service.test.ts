import { test } from "node:test";
import assert from "node:assert/strict";
import { AppConfigService } from "./app-config.service";
import { NotFoundException } from "@nestjs/common";

test("public app config returns concrete login image object url without opening image stream", async () => {
  const assetStorage = {
    listObjects: async () => ["uploads/admin/login-image/login-image.png"],
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`,
    readObject: async () => {
      throw new Error("getPublicConfig should not open asset streams");
    }
  };
  const service = new AppConfigService({} as never, assetStorage as never);

  const config = await service.getPublicConfig({});

  assert.equal(config.login.imageUrl, "/static/uploads/admin/login-image/login-image.png");
});

test("public app config includes cook assistant activity policy without personal usage", async () => {
  const assetStorage = {
    listObjects: async () => [],
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new AppConfigService({} as never, assetStorage as never);

  const config = await service.getPublicConfig({});

  assert.deepEqual(config.cookAssistant, {
    activityEnabled: true,
    startsAt: null,
    endsAt: null,
    timeZone: "Asia/Shanghai",
    dailyUnlockLimit: 2,
    tipText: "活动期间，免费生成，每天 2 次，当日有效"
  });
  assert.equal("usedCount" in config, false);
  assert.equal("remainingCount" in config, false);
});

test("stored login image route only returns the current concrete file name", async () => {
  const assetStorage = {
    listObjects: async () => ["uploads/admin/login-image/login-image.png"],
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`,
    readObject: async () => ({
      contentType: "image/png",
      size: 1,
      stream: null
    })
  };
  const service = new AppConfigService({} as never, assetStorage as never);

  await assert.rejects(() => service.getLoginImageAsset("login-image.jpg"), NotFoundException);
});
