import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { OPTIONAL_DEPS_METADATA } from "@nestjs/common/constants";
import { AdminRecipeImageService } from "./admin-recipe-image.service";

test("keeps the remote image reader optional for Nest startup", () => {
  assert.deepEqual(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, AdminRecipeImageService), [1]);
});

function pngBuffer() {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000970485973000003e8000003e801b57b526b0000000d49444154789c63f8cfc0f01f00050001ff89993d1d0000000049454e44ae426082",
    "hex"
  );
}

function createService(
  writes: Array<{ key: string; buffer: Buffer; contentType: string }>,
  remoteReader?: (url: string) => Promise<Buffer>
) {
  return new AdminRecipeImageService({
    writeObject: async (key: string, buffer: Buffer, contentType: string) => writes.push({ key, buffer, contentType }),
    publicUrl: (_request: unknown, key: string) => `https://cdn.example/${key}`
  } as never, remoteReader);
}

test("downloads a remote image and stores it through the current asset driver", async () => {
  const writes: Array<{ key: string; buffer: Buffer; contentType: string }> = [];
  const requestedUrls: string[] = [];
  const remoteReader = async (url: string) => {
    requestedUrls.push(url);
    return pngBuffer();
  };

  const published = await createService(writes, remoteReader).publishRemoteImage({}, 10000042, "STEP", "https://1.1.1.1/step.png");

  assert.deepEqual(requestedUrls, ["https://1.1.1.1/step.png"]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.contentType, "image/webp");
  assert.notDeepEqual(writes[0]?.buffer, pngBuffer());
  assert.match(writes[0]?.key ?? "", /^uploads\/recipe-images\/10000042\/[0-9a-f-]+\.webp$/);
  assert.match(published.imageUrl, /^https:\/\/cdn\.example\/uploads\/recipe-images\/10000042\/[0-9a-f-]+\.webp$/);
});

test("rejects private remote addresses before making a request", async () => {
  let readerCalls = 0;
  const remoteReader = async () => {
    readerCalls += 1;
    return pngBuffer();
  };

  await assert.rejects(
    () => createService([], remoteReader).publishRemoteImage({}, 10000042, "COVER", "http://127.0.0.1/image.png"),
    (error: unknown) => error instanceof BadRequestException && error.message === "远程图片地址不安全"
  );
  assert.equal(readerCalls, 0);
});

test("rejects non-image and oversized remote responses", async () => {
  await assert.rejects(
    () => createService([], async () => Buffer.from("not an image")).publishRemoteImage({}, 10000042, "STEP", "https://1.1.1.1/page"),
    /图片损坏或无法压缩/
  );

  await assert.rejects(
    () => createService([], async () => Buffer.alloc(10 * 1024 * 1024 + 1)).publishRemoteImage({}, 10000042, "STEP", "https://1.1.1.1/large.png"),
    /不能超过 10 MB/
  );
});

test("reports temporary image cleanup failures", async () => {
  const service = new AdminRecipeImageService({
    deleteObject: async () => {
      throw new Error("oss delete failed");
    }
  } as never);

  assert.deepEqual(await service.discardTempImages(["temp-image.png"]), ["temp-image.png"]);
});

test("maps published recipe image URLs back to storage keys", () => {
  const service = createService([]);

  assert.equal(
    service.publishedStorageKeyFromUrl("https://cdn.example/static/uploads/recipe-images/10000042/step.jpg?version=1"),
    "uploads/recipe-images/10000042/step.jpg"
  );
  assert.equal(
    service.publishedStorageKeyFromUrl("https://cdn.example/static/uploads/admin-recipe-images/old.jpg"),
    "uploads/admin-recipe-images/old.jpg"
  );
  assert.equal(
    service.publishedStorageKeyFromUrl("https://cdn.example/static/admin-recipe-images/older.jpg"),
    "uploads/admin-recipe-images/older.jpg"
  );
  assert.equal(service.publishedStorageKeyFromUrl("https://cdn.example/uploads/material-store/other.jpg"), null);
});
