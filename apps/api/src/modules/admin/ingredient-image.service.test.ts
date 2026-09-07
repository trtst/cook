import assert from "node:assert/strict";
import test from "node:test";
import { IngredientImageService } from "./ingredient-image.service";

const assetStorage = {
  publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
    `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`
};

test("ingredient image public url includes the stored png extension", () => {
  const service = new IngredientImageService(assetStorage as never);

  assert.equal(
    service.buildImageUrl({}, 12, new Date("2026-09-06T12:00:00.000Z")),
    "/static/uploads/ingredients/12.png?v=2026-09-06T12%3A00%3A00.000Z"
  );
});
