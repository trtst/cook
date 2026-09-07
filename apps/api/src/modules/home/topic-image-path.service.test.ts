import assert from "node:assert/strict";
import test from "node:test";
import { HomeTopicImageService } from "./home-topic-image.service";
import { TableTopicImageService } from "./table-topic-image.service";

const assetStorage = {
  publicUrl: (_request: unknown, storageKey: string) => `/static/${storageKey}`
};

test("home topic image public path includes the stored image extension", () => {
  const service = new HomeTopicImageService(assetStorage as never);

  assert.equal(service.buildImagePath(7, "jpeg"), "/static/uploads/home-topics/7.jpg");
  assert.equal(service.buildImagePath(7, "png"), "/static/uploads/home-topics/7.png");
  assert.equal(service.buildImagePath(7, "webp"), "/static/uploads/home-topics/7.webp");
});

test("table topic image public path includes the stored image extension", () => {
  const service = new TableTopicImageService(assetStorage as never);

  assert.equal(service.buildImagePath(7, "jpeg"), "/static/uploads/table-topics/7.jpg");
  assert.equal(service.buildImagePath(7, "png"), "/static/uploads/table-topics/7.png");
  assert.equal(service.buildImagePath(7, "webp"), "/static/uploads/table-topics/7.webp");
});
