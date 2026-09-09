import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { OPTIONAL_DEPS_METADATA } from "@nestjs/common/constants";
import { AdminRecipeImageService } from "./admin-recipe-image.service";

test("keeps the remote image reader optional for Nest startup", () => {
  assert.deepEqual(Reflect.getMetadata(OPTIONAL_DEPS_METADATA, AdminRecipeImageService), [1]);
});

function pngBuffer() {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(4, 16);
  buffer.writeUInt32BE(3, 20);
  return buffer;
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

  const published = await createService(writes, remoteReader).publishRemoteImage({}, "STEP", "https://1.1.1.1/step.png");

  assert.deepEqual(requestedUrls, ["https://1.1.1.1/step.png"]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.contentType, "image/png");
  assert.deepEqual(writes[0]?.buffer, pngBuffer());
  assert.match(published.imageUrl, /^https:\/\/cdn\.example\/uploads\/admin-recipe-images\//);
});

test("rejects private remote addresses before making a request", async () => {
  let readerCalls = 0;
  const remoteReader = async () => {
    readerCalls += 1;
    return pngBuffer();
  };

  await assert.rejects(
    () => createService([], remoteReader).publishRemoteImage({}, "COVER", "http://127.0.0.1/image.png"),
    (error: unknown) => error instanceof BadRequestException && error.message === "远程图片地址不安全"
  );
  assert.equal(readerCalls, 0);
});

test("rejects non-image and oversized remote responses", async () => {
  await assert.rejects(
    () => createService([], async () => Buffer.from("not an image")).publishRemoteImage({}, "STEP", "https://1.1.1.1/page"),
    /仅支持 JPG、PNG、WEBP 图片/
  );

  await assert.rejects(
    () => createService([], async () => Buffer.alloc(10 * 1024 * 1024 + 1)).publishRemoteImage({}, "STEP", "https://1.1.1.1/large.png"),
    /不能超过 10 MB/
  );
});

test("maps only published admin recipe image URLs back to storage keys", () => {
  const service = createService([]);

  assert.equal(
    service.publishedStorageKeyFromUrl("https://cdn.example/static/uploads/admin-recipe-images/step.jpg?version=1"),
    "uploads/admin-recipe-images/step.jpg"
  );
  assert.equal(service.publishedStorageKeyFromUrl("https://cdn.example/uploads/material-store/other.jpg"), null);
});
