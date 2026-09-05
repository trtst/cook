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
