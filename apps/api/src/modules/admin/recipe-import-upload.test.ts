import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { recipeJsonUploadStorage } from "./recipe-import-upload";

const megabyte = 1024 * 1024;

function handleFile(request: Record<string, unknown>, buffer: Buffer) {
  return new Promise<{ buffer: Buffer; size: number }>((resolve, reject) => {
    recipeJsonUploadStorage._handleFile(
      request,
      { stream: Readable.from([buffer]) },
      (error, info) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(info as { buffer: Buffer; size: number });
      }
    );
  });
}

test("keeps accepted JSON upload batches within the 20 MB aggregate limit", async () => {
  const request: Record<string, unknown> = {};
  const first = await handleFile(request, Buffer.alloc(10 * megabyte));
  const second = await handleFile(request, Buffer.alloc(10 * megabyte));

  assert.equal(first.size, 10 * megabyte);
  assert.equal(second.size, 10 * megabyte);
});

test("rejects a JSON upload as soon as the aggregate stream exceeds 20 MB", async () => {
  const request: Record<string, unknown> = {};
  await handleFile(request, Buffer.alloc(10 * megabyte));

  await assert.rejects(
    handleFile(request, Buffer.alloc(10 * megabyte + 1)),
    /批量 JSON 总大小不能超过 20 MB/
  );
});
