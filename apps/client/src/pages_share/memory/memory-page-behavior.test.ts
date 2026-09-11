import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const posterSource = readFileSync(resolve(__dirname, "MemoryPoster.vue"), "utf8");

test("participant switch treats only true as visible and drops an existing share snapshot immediately", () => {
  assert.match(source, /rawValue === true \|\| rawValue === "true"/);
  assert.match(source, /showParticipants\.value = rawValue === true \|\| rawValue === "true";\s*invalidateGeneratedPoster\(\);/);
});

test("caption is labelled in the poster preview above the footer", () => {
  assert.match(posterSource, /<text class="poster__quote-label">这次回忆<\/text>/);
});

test("memory poster uses the configured HTTPS logo in both preview and canvas", () => {
  assert.match(source, /loadCanvasImage\(canvas, MEMORY_POSTER_TEMPLATE\.brandLogoUrl\)/);
  assert.match(posterSource, /<image class="poster__logo" :src="MEMORY_POSTER_TEMPLATE\.brandLogoUrl"/);
});

test("event mode poster actions are limited to the dining event organizer", () => {
  assert.match(source, /const canManageEventShare = computed\(\(\) => Boolean\(eventDetail\.value && eventDetail\.value\.organizerUid === sessionStore\.uid\)\)/);
  assert.match(source, /eventId\.value && generateReady\.value && canManageEventShare\.value/);
  assert.match(source, /if \(!eventId\.value \|\| !generateReady\.value \|\| !canManageEventShare\.value \|\| submitting\.value\) return null;/);
  assert.match(source, /v-if="canPreparePoster \|\| posterFilePath"/);
  assert.match(source, /if \(!canPreparePoster\.value && !posterFilePath\.value\) return;/);
});
