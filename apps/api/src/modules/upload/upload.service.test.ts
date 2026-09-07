import assert from "node:assert/strict";
import test from "node:test";
import { UploadService } from "./upload.service";

const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200015ff3d1b50000000049454e44ae426082",
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

  assert.match(writtenKeys[0], /^uploads\/profile-avatars\/52738164\/[0-9a-f-]+\.png$/);
  assert.doesNotMatch(writtenKeys[0], /profile-avatars\/273\//);
  assert.match(result.avatarUrl, /^\/static\/uploads\/profile-avatars\/52738164\/[0-9a-f-]+\.png\?v=/);
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

  const result = await service.uploadRecipeImage({}, 9, "10087", 31, "RECIPE_COVER", "cover", {
    buffer: png1x1,
    size: png1x1.length
  });

  assert.match(writtenKeys[0], /^uploads\/recipe-images\/[0-9a-f-]+\.png$/);
  assert.match(result.upload.imageUrl, /^\/static\/uploads\/recipe-images\/[0-9a-f-]+\.png\?v=/);
});

test("recipe image public read accepts the file name with extension", async () => {
  const storedKey = "uploads/recipe-images/11111111-1111-4111-8111-111111111111.png";
  const prisma = {
    uploadAsset: {
      findFirst: async ({ where }: { where: { publicId: string } }) => {
        assert.equal(where.publicId, "11111111-1111-4111-8111-111111111111");
        return {
          storageKey: storedKey,
          contentType: "image/png"
        };
      }
    }
  };
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
  const service = new UploadService(prisma as never, assetStorage as never);

  const asset = await service.getRecipeImageAsset("11111111-1111-4111-8111-111111111111.png");

  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.stat.size, png1x1.length);
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
