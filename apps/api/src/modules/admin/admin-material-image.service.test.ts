import assert from "node:assert/strict";
import test from "node:test";
import { AdminMaterialImageService } from "./admin-material-image.service";

const png1x1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200015ff3d1b50000000049454e44ae426082",
  "hex"
);

test("admin material image upload stores image in the public material-store folder with note metadata", async () => {
  const written: Array<{ storageKey: string; contentType: string }> = [];
  const rows: unknown[] = [];
  const admin = { id: 1, status: "ACTIVE", roles: ["SUPER_ADMIN"] };
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => ({}),
      updateMany: async () => ({ count: 1 })
    },
    adminAccount: {
      findUnique: async () => admin
    },
    adminMaterialImage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: 32,
          ...data,
          uploader: admin,
          createdAt: new Date("2026-09-05T09:00:00.000Z"),
          updatedAt: new Date("2026-09-05T09:00:00.000Z")
        };
        rows.push(row);
        return row;
      }
    }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback(tx)
  };
  const assetStorage = {
    writeObject: async (storageKey: string, _buffer: Buffer, contentType: string) => {
      written.push({ storageKey, contentType });
    },
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new AdminMaterialImageService(prisma as never, assetStorage as never);

  const result = await service.uploadImage(
    {},
    admin.id,
    "10001",
    "首页 header 备用图",
    { buffer: png1x1, size: png1x1.length }
  );

  assert.equal(written.length, 1);
  assert.match(written[0].storageKey, /^uploads\/material-store\/[0-9a-f-]+\.png$/);
  assert.equal(written[0].contentType, "image/png");
  assert.equal(rows.length, 1);
  assert.equal((rows[0] as { note: string }).note, "首页 header 备用图");
  assert.equal(result.note, "首页 header 备用图");
  assert.match(result.imageUrl, /^\/static\/uploads\/material-store\/[0-9a-f-]+\.png$/);
});

test("admin material image list exposes legacy rows through the material-store public path", async () => {
  const row = {
    id: 41,
    storageKey: "uploads/admin-material-images/legacy.png",
    note: "杂乱的素材堆砌",
    contentType: "image/png",
    sizeBytes: 68,
    width: 1,
    height: 1,
    uploadedByAdminId: 1,
    createdAt: new Date("2026-09-05T09:00:00.000Z"),
    updatedAt: new Date("2026-09-05T09:00:00.000Z"),
    uploader: { id: 1, displayName: "运营" }
  };
  const prisma = {
    adminMaterialImage: {
      findMany: async () => [row],
      count: async () => 1
    }
  };
  const assetStorage = {
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new AdminMaterialImageService(prisma as never, assetStorage as never);

  const result = await service.listImages({}, 1, 20);

  assert.equal(result.items[0].imageUrl, "/static/uploads/material-store/legacy.png");
});

test("admin material image delete removes the stored object and record without reference checks", async () => {
  const deletedKeys: string[] = [];
  const row = {
    id: 18,
    storageKey: "uploads/admin-material-images/header.png",
    note: "已复制到首页",
    contentType: "image/png",
    sizeBytes: 68,
    width: 1,
    height: 1,
    uploadedByAdminId: 1,
    createdAt: new Date("2026-09-05T09:00:00.000Z"),
    updatedAt: new Date("2026-09-05T09:00:00.000Z"),
    uploader: { id: 1, displayName: "运营" }
  };
  const prisma = {
    $transaction: async (callback: (nextTx: unknown) => Promise<unknown>) => callback({
      $queryRaw: async () => [{ ok: "1" }],
      idempotencyRecord: {
        findFirst: async () => null,
        create: async () => ({}),
        updateMany: async () => ({ count: 1 })
      },
      adminAccount: {
        findUnique: async () => ({ id: 1, status: "ACTIVE", roles: ["SUPER_ADMIN"] })
      },
      adminMaterialImage: prisma.adminMaterialImage
    }),
    adminMaterialImage: {
      findUnique: async () => row,
      delete: async ({ where }: { where: { id: number } }) => {
        assert.equal(where.id, row.id);
        return row;
      }
    }
  };
  const assetStorage = {
    deleteObject: async (storageKey: string) => {
      deletedKeys.push(storageKey);
    },
    publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
  };
  const service = new AdminMaterialImageService(prisma as never, assetStorage as never);

  await service.deleteImage(1, "10002", row.id);

  assert.deepEqual(deletedKeys, [row.storageKey]);
});
