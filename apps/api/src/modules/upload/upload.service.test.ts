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
