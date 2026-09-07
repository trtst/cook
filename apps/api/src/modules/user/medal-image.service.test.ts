import assert from "node:assert/strict";
import test from "node:test";
import { MedalImageService } from "./medal-image.service";

test("medal image replacement writes the stable public object key used by its url", async () => {
  const movedTargets: string[] = [];
  const assetStorage = {
    publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
      `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`,
    readObject: async () => null,
    deleteObject: async () => undefined,
    moveObject: async (_sourceKey: string, targetKey: string) => {
      movedTargets.push(targetKey);
    }
  };
  const service = new MedalImageService(assetStorage as never);

  await service.replaceStagedImage(12, "earned", "uploads/medals/.tmp/12-earned-demo.png", "png");

  assert.equal(movedTargets.at(-1), "uploads/medals/12");
  assert.equal(service.buildImageUrl({}, 12, "earned", new Date("2026-09-06T12:00:00.000Z")), "/static/uploads/medals/12?v=2026-09-06T12%3A00%3A00.000Z");
});
