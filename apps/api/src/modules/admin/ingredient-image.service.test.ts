import assert from "node:assert/strict";
import test from "node:test";
import { IngredientImageService } from "./ingredient-image.service";

const assetStorage = {
  publicUrl: (_request: unknown, storageKey: string, updatedAt?: Date | null) =>
    `/static/${storageKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt.toISOString())}` : ""}`
};

test("ingredient image url returns the persisted value without deriving a legacy path", () => {
  const service = new IngredientImageService(assetStorage as never);

  const imageUrl = "/uploads/ingredients/12.jpg?x-oss-process=image/resize,m_fixed,w_60,h_60";
  assert.equal(service.buildImageUrl(imageUrl), imageUrl);
});
