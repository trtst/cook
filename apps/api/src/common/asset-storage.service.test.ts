import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AssetStorageService, assetPublicUrl, loadAssetStorageConfig } from "./asset-storage.service";

function withEnv<T>(nextEnv: Record<string, string | undefined>, run: () => T) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(nextEnv)) {
    previous.set(key, process.env[key]);
    const value = nextEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("assetPublicUrl uses static upload host when configured", () => {
  const url = withEnv(
    {
      ASSET_PUBLIC_BASE_URL: "https://static.trtst.com"
    },
    () =>
      assetPublicUrl(
        {
          protocol: "https",
          get: name => (name.toLowerCase() === "host" ? "api.trtst.com" : undefined)
        },
        "uploads/recipes/1/cover.webp",
        new Date("2026-09-05T08:00:00.000Z")
      )
  );

  assert.equal(url, "https://static.trtst.com/uploads/recipes/1/cover.webp?v=2026-09-05T08%3A00%3A00.000Z");
});

test("assetPublicUrl falls back to request host under /static/uploads", () => {
  const url = withEnv({ ASSET_PUBLIC_BASE_URL: undefined }, () =>
    assetPublicUrl(
      {
        protocol: "https",
        get: name => (name.toLowerCase() === "host" ? "api.trtst.com" : undefined)
      },
      "uploads/home-topics/8.webp"
    )
  );

  assert.equal(url, "https://api.trtst.com/static/uploads/home-topics/8.webp");
});

test("oss storage config requires bucket and endpoint", () => {
  assert.throws(
    () =>
      withEnv(
        {
          ASSET_STORAGE_DRIVER: "oss",
          OSS_REGION: "oss-cn-beijing",
          OSS_BUCKET: undefined,
          OSS_ENDPOINT: "oss-cn-beijing.aliyuncs.com",
          OSS_ACCESS_KEY_ID: "key",
          OSS_ACCESS_KEY_SECRET: "secret"
        },
        () => loadAssetStorageConfig()
      ),
    /OSS_BUCKET/
  );
});

test("local storage writes under configured environment prefix", async () => {
  const root = join(tmpdir(), `cook-assets-${Date.now()}`);
  await mkdir(root, { recursive: true });
  try {
    await withEnv(
      {
        ASSET_STORAGE_DRIVER: "local",
        APP_ASSET_DIR: root,
        ASSET_STORAGE_PREFIX: "dev"
      },
      async () => {
        const storage = new AssetStorageService();
        await storage.writeObject("uploads/demo/a.txt", Buffer.from("ok"), "text/plain");
        const content = await readFile(join(root, "dev", "uploads", "demo", "a.txt"), "utf8");
        assert.equal(content, "ok");
        assert.equal(storage.publicUrl({}, "uploads/demo/a.txt"), "/static/uploads/demo/a.txt");
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
