import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./HomeTopicsPage.vue", import.meta.url), "utf8");

test("batch preview remains bound to the exact JSON text sent to the API", () => {
  assert.match(page, /const source = importJson\.value;/);
  assert.match(page, /JSON\.parse\(source\)/);
  assert.match(page, /await homeTopicsApi\.previewBatchImport\(parsed\)/);
  assert.match(page, /previewSource\.value = source;/);
  assert.doesNotMatch(page, /previewSource\.value = importJson\.value/);
});

test("batch import is disabled when the JSON differs from the last preview", () => {
  assert.match(page, /previewSource\.value !== importJson\.value/);
  assert.match(page, /importableCount\.value < 1/);
  assert.match(page, /homeTopicsApi\.importBatch\(batch, createOperationId\(\)\)/);
});
