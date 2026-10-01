import assert from "node:assert/strict";
import test from "node:test";
import { UploadService } from "./upload.service";

const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000970485953000003e8000003e801b57b526b0000000d49444154789c63f8cfc0f01f00050001ff89993d1d0000000049454e44ae426082",
  "hex"
);

test("user avatar upload stores public path under uid instead of internal user id", async () => {
  const writtenKeys: string[] = [];
  const currentUser = {
    id: 273,
    uid: 52738164,
    status: "ACTIVE"
  };
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    user: {
      findUnique: async () => currentUser,
      update: async ({ data }: { data: { avatarUrl: string } }) => ({ ...currentUser, ...data })
    }
  };
  const prisma = {
    user: {
      findUnique: async () => ({ id: currentUser.id, status: currentUser.status })
    },
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const assetStorage = {
    writeObject: async (storageKey: string) => {
      writtenKeys.push(storageKey);
    },
    publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
      `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const result = await service.uploadUserAvatar({}, currentUser.id, "10086", {
    buffer: png1x1,
    size: png1x1.length
  });

  assert.match(writtenKeys[0], /^uploads\/profile-avatars\/52738164\/[0-9a-f-]+\.webp$/);
  assert.doesNotMatch(writtenKeys[0], /profile-avatars\/273\//);
  assert.match(result.avatarUrl, /^\/static\/uploads\/profile-avatars\/52738164\/[0-9a-f-]+\.webp\?v=/);
  assert.doesNotMatch(result.avatarUrl, /profile-avatars\/273\//);
});

test("recipe image upload returns the public object key with image extension", async () => {
  const writtenKeys: string[] = [];
  const persistedAt = new Date("2026-09-06T12:00:00.000Z");
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    recipeDraft: {
      findFirst: async () => ({ id: 31 })
    },
    uploadAsset: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 51,
        publicId: data.publicId,
        scene: data.scene,
        slotKey: data.slotKey,
        status: data.status,
        storageKey: data.storageKey,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes,
        width: data.width,
        height: data.height,
        createdAt: persistedAt,
        updatedAt: persistedAt,
        expiresAt: data.expiresAt
      })
    }
  };
  const prisma = {
    recipeDraft: {
      findFirst: async () => ({ id: 31 })
    },
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const assetStorage = {
    writeObject: async (storageKey: string) => {
      writtenKeys.push(storageKey);
    },
    publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
      `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const result = await service.uploadRecipeImage({}, 9, "10087", 31, "RECIPE_STEP", "step-1", {
    buffer: png1x1,
    size: png1x1.length
  });

  assert.match(writtenKeys[0], /^uploads\/recipe-images\/\.tmp\/31\/[0-9a-f-]+\.webp$/);
  assert.match(result.upload.imageUrl, /^\/static\/uploads\/recipe-images\/\.tmp\/31\/[0-9a-f-]+\.webp\?v=/);
});

test("draft recipe image reads require an owned temporary upload before storage access", async () => {
  const fileName = "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png";
  let readKey = "";
  const prisma = {
    recipeDraft: {
      findFirst: async ({ where }: { where: { id: number; userId: number } }) => {
        assert.deepEqual(where, { id: 31, userId: 17 });
        return { id: 31 };
      }
    },
    uploadAsset: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, {
          userId: 17,
          draftId: 31,
          publicId: "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00",
          status: "TEMP",
          type: "RECIPE"
        });
        return {
          storageKey: "uploads/recipe-images/.tmp/31/a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png",
          contentType: "image/png"
        };
      }
    }
  };
  const assetStorage = {
    readObject: async (storageKey: string, contentType: string) => {
      readKey = storageKey;
      assert.equal(contentType, "image/png");
      return { contentType, size: png1x1.length, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const asset = await service.getDraftRecipeImageAsset(17, 31, fileName);

  assert.equal(asset.contentType, "image/png");
  assert.equal(readKey, "uploads/recipe-images/.tmp/31/a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png");
});

test("draft recipe image reads do not access storage for an unowned upload", async () => {
  let readAttempted = false;
  const prisma = {
    recipeDraft: { findFirst: async () => ({ id: 31 }) },
    uploadAsset: { findFirst: async () => null }
  };
  const assetStorage = {
    readObject: async () => {
      readAttempted = true;
      return { contentType: "image/png", size: png1x1.length, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  await assert.rejects(
    () => service.getDraftRecipeImageAsset(17, 31, "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png"),
    /图片不存在/
  );
  assert.equal(readAttempted, false);
});

test("draft upload storage copies are prepared before the publication transaction", async () => {
  const upload = {
    id: 51,
    userId: 17,
    draftId: 31,
    publicId: "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00",
    storageKey: "uploads/recipe-images/.tmp/31/a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png",
    contentType: "image/png",
    status: "TEMP",
    type: "RECIPE",
    updatedAt: new Date("2026-10-01T12:00:00.000Z"),
    sourceHash: "a".repeat(64)
  };
  const copied: Array<{ source: string; target: string }> = [];
  const prisma = {
    uploadAsset: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, { id: { in: [51] }, userId: 17, draftId: 31, status: "TEMP", type: "RECIPE" });
        return [upload];
      }
    }
  };
  const assetStorage = {
    copyObject: async (source: string, target: string) => copied.push({ source, target })
  };
  const service = new UploadService(prisma as never, assetStorage as never);
  const promotedKeys: string[] = [];
  const temporaryKeys: string[] = [];

  const prepared = await service.copyDraftUploads(17, 31, 91, [51], promotedKeys, temporaryKeys);

  assert.deepEqual(copied, [{
    source: upload.storageKey,
    target: `uploads/recipe-images/91/${prepared.get(51)?.targetPublicId}.png`
  }]);
  assert.deepEqual(promotedKeys, [prepared.get(51)?.targetStorageKey]);
  assert.deepEqual(temporaryKeys, [upload.storageKey]);
  assert.match(prepared.get(51)?.targetPublicId ?? "", /^[0-9a-f-]{36}$/i);
  assert.notEqual(prepared.get(51)?.targetPublicId, upload.publicId);
  assert.equal(prepared.get(51)?.sourceUpdatedAt, upload.updatedAt);
  assert.equal(prepared.get(51)?.sourceHash, upload.sourceHash);
});

test("draft upload promotion in a transaction updates only the database reference", async () => {
  let copyAttempted = false;
  const upload = {
    ...{
      id: 51,
      publicId: "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00",
      storageKey: "uploads/recipe-images/.tmp/31/a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png",
      updatedAt: new Date("2026-10-01T12:00:00.000Z"),
      sourceHash: "a".repeat(64)
    }
  };
  const tx = {
    uploadAsset: {
      findMany: async () => [upload],
      update: async ({ data }: { data: { publicId: string; storageKey: string } }) => ({ ...upload, ...data, updatedAt: new Date("2026-10-01T12:01:00.000Z") })
    }
  };
  const assetStorage = {
    copyObject: async () => {
      copyAttempted = true;
    },
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new UploadService({} as never, assetStorage as never);

  const urls = await service.promoteDraftUploads(tx as never, {}, 17, 31, 91, [51], new Map([[51, {
    sourceStorageKey: upload.storageKey,
    sourcePublicId: upload.publicId,
    sourceUpdatedAt: upload.updatedAt,
    sourceHash: upload.sourceHash,
    targetPublicId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    targetStorageKey: "uploads/recipe-images/91/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.png"
  }]]));

  assert.equal(copyAttempted, false);
  assert.equal(urls.get(51), "/static/uploads/recipe-images/91/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.png");
});

test("draft upload promotion rejects an image replaced after external copy", async () => {
  let updateAttempted = false;
  const originalUpdatedAt = new Date("2026-10-01T12:00:00.000Z");
  const upload = {
    id: 51,
    publicId: "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00",
    storageKey: "uploads/recipe-images/.tmp/31/a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00.png",
    updatedAt: new Date("2026-10-01T12:02:00.000Z"),
    sourceHash: "b".repeat(64)
  };
  const tx = {
    uploadAsset: {
      findMany: async () => [upload],
      update: async () => {
        updateAttempted = true;
        return upload;
      }
    }
  };
  const service = new UploadService({} as never, { publicUrl: () => "" } as never);

  await assert.rejects(() => service.promoteDraftUploads(tx as never, {}, 17, 31, 91, [51], new Map([[51, {
    sourceStorageKey: upload.storageKey,
    sourcePublicId: "a1b2c3d4-e5f6-4789-aaaa-bbccddeeff00",
    sourceUpdatedAt: originalUpdatedAt,
    sourceHash: "a".repeat(64),
    targetPublicId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    targetStorageKey: "uploads/recipe-images/91/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.png"
  }]])), /草稿图片状态已变更/);
  assert.equal(updateAttempted, false);
});

test("recipe image public read uses recipe ID and file name", async () => {
  const fileName = "11111111-1111-4111-8111-111111111111.png";
  const storedKey = `uploads/recipe-images/10000031/${fileName}`;
  const assetStorage = {
    readObject: async (storageKey: string, contentType: string) => {
      assert.equal(storageKey, storedKey);
      assert.equal(contentType, "image/png");
      return {
        contentType,
        size: png1x1.length,
        stream: {}
      };
    }
  };
  const service = new UploadService({} as never, assetStorage as never);

  const asset = await service.getRecipeImageAsset(10000031, fileName);

  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.stat.size, png1x1.length);
});

test("memory share cover is copied to a snapshot-owned immutable key", async () => {
  const copied: Array<{ source: string; target: string }> = [];
  let streamDestroyed = false;
  const assetStorage = {
    readObject: async () => ({ size: 4321, stream: { destroy: () => { streamDestroyed = true; } } }),
    copyObject: async (source: string, target: string) => copied.push({ source, target }),
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new UploadService({} as never, assetStorage as never);

  const result = await service.copyDiningEventCoverToMemory(
    "uploads/dining-event-covers/82/source.webp",
    "image/webp",
    82,
    3
  );

  assert.deepEqual(copied, [{
    source: "uploads/dining-event-covers/82/source.webp",
    target: "uploads/dining-event-memory-covers/82/3.webp"
  }]);
  assert.deepEqual(result, {
    storageKey: "uploads/dining-event-memory-covers/82/3.webp",
    contentType: "image/webp"
  });
  assert.equal(streamDestroyed, true);
  assert.equal(service.buildDiningMemoryAssetUrl({}, result.storageKey), "/static/uploads/dining-event-memory-covers/82/3.webp");
});

test("memory share mini code is stored with the image type returned by WeChat", async () => {
  const written: Array<{ key: string; contentType: string }> = [];
  const assetStorage = {
    writeObject: async (key: string, _buffer: Buffer, contentType: string) => written.push({ key, contentType }),
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new UploadService({} as never, assetStorage as never);

  const key = await service.storeDiningMemoryMiniCode("abc123", Buffer.from("jpeg"), "image/jpeg");

  assert.equal(key, "uploads/dining-event-memory-codes/abc123.jpg");
  assert.deepEqual(written, [{ key, contentType: "image/jpeg" }]);
});

test("memory share storage keys can be reserved before external writes", () => {
  const service = new UploadService({} as never, {} as never);

  assert.equal(
    service.buildDiningMemoryCoverStorageKey(82, 3, "image/webp"),
    "uploads/dining-event-memory-covers/82/3.webp"
  );
  assert.equal(
    service.buildDiningMemoryMiniCodeStorageKey("a".repeat(64), "image/png"),
    `uploads/dining-event-memory-codes/${"a".repeat(64)}.png`
  );
  assert.equal(
    service.buildDiningMemoryMiniCodeStorageKey("b".repeat(64), "image/jpeg"),
    `uploads/dining-event-memory-codes/${"b".repeat(64)}.jpg`
  );
});

test("memory share cover public read resolves only a referenced snapshot asset", async () => {
  const storedKey = "uploads/dining-event-memory-covers/82/3.webp";
  const prisma = {
    diningEventMemoryShare: {
      findFirst: async ({ where }: { where: { diningEventId: number; coverStorageKey: { endsWith: string } } }) => {
        assert.equal(where.diningEventId, 82);
        assert.equal(where.coverStorageKey.endsWith, "/3.webp");
        return { coverStorageKey: storedKey, coverContentType: "image/webp" };
      }
    }
  };
  const assetStorage = {
    readObject: async (storageKey: string, contentType: string) => {
      assert.equal(storageKey, storedKey);
      assert.equal(contentType, "image/webp");
      return { contentType, size: 4321, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const asset = await service.getDiningMemoryCoverAsset(82, "3.webp");

  assert.equal(asset.contentType, "image/webp");
  assert.equal(asset.stat.size, 4321);
});

test("memory share mini code public read only accepts a token hash file name", async () => {
  const hash = "a".repeat(64);
  const storedKey = `uploads/dining-event-memory-codes/${hash}.png`;
  const prisma = {
    diningEventMemoryShare: {
      findFirst: async ({ where }: { where: { miniCodeStorageKey: string } }) => {
        assert.equal(where.miniCodeStorageKey, storedKey);
        return { miniCodeStorageKey: storedKey };
      }
    }
  };
  const assetStorage = {
    readObject: async (storageKey: string, contentType: string) => {
      assert.equal(storageKey, storedKey);
      assert.equal(contentType, "image/png");
      return { contentType, size: png1x1.length, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const asset = await service.getDiningMemoryMiniCodeAsset(`${hash}.png`);

  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.stat.size, png1x1.length);
});

test("memory share mini code public read retains the JPEG content type", async () => {
  const hash = "c".repeat(64);
  const storedKey = `uploads/dining-event-memory-codes/${hash}.jpg`;
  const prisma = {
    diningEventMemoryShare: {
      findFirst: async ({ where }: { where: { miniCodeStorageKey: string } }) => {
        assert.equal(where.miniCodeStorageKey, storedKey);
        return { miniCodeStorageKey: storedKey };
      }
    }
  };
  const assetStorage = {
    readObject: async (storageKey: string, contentType: string) => {
      assert.equal(storageKey, storedKey);
      assert.equal(contentType, "image/jpeg");
      return { contentType, size: 4321, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  const asset = await service.getDiningMemoryMiniCodeAsset(`${hash}.jpg`);

  assert.equal(asset.contentType, "image/jpeg");
  assert.equal(asset.stat.size, 4321);
});

test("memory share mini code public read rejects unreferenced storage objects", async () => {
  const hash = "b".repeat(64);
  let readAttempted = false;
  const prisma = {
    diningEventMemoryShare: {
      findFirst: async () => null
    }
  };
  const assetStorage = {
    readObject: async () => {
      readAttempted = true;
      return { contentType: "image/png", size: png1x1.length, stream: {} };
    }
  };
  const service = new UploadService(prisma as never, assetStorage as never);

  await assert.rejects(() => service.getDiningMemoryMiniCodeAsset(`${hash}.png`), /图片不存在/);
  assert.equal(readAttempted, false);
});

test("dining event cover public url uses the stored object key with image extension", async () => {
  const assetStorage = {
    publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
      `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`
  };
  const service = new UploadService({} as never, assetStorage as never);

  const url = service.buildDiningEventCoverUrl({}, "uploads/dining-event-covers/41/demo.png", new Date("2026-09-06T12:00:00.000Z"));

  assert.equal(url, "/static/uploads/dining-event-covers/41/demo.png?v=2026-09-06T12%3A00%3A00.000Z");
});

test("storage cleanup returns keys whose deletion failed", async () => {
  const assetStorage = {
    deleteObject: async (storageKey: string) => {
      if (storageKey === "uploads/failed.png") throw new Error("storage unavailable");
    }
  };
  const service = new UploadService({} as never, assetStorage as never);

  const failedKeys = await service.removeStorageFiles(["uploads/ok.png", "uploads/failed.png"]);

  assert.deepEqual(failedKeys, ["uploads/failed.png"]);
});
