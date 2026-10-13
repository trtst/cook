import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor = readFileSync(new URL("./HomeTopicEditorPage.vue", import.meta.url), "utf8");
const api = readFileSync(new URL("../apis/home-topics.ts", import.meta.url), "utf8");
const cover = readFileSync(new URL("../utils/home-topic-cover.ts", import.meta.url), "utf8");

test("weekly cover generation fetches the selected topic code and saves with optimistic version", () => {
  assert.match(api, /getTopicMiniCode\(topicId: UUID\)[\s\S]*?`\/admin\/home-topics\/\$\{encodeURIComponent\(String\(topicId\)\)\}\/mini-code`/);
  assert.match(editor, /const miniCode = await homeTopicsApi\.getTopicMiniCode\(current\.id\);/);
  assert.match(editor, /periodStartDate: current\.periodStartDate,[\s\S]*?periodEndDate: current\.periodEndDate,[\s\S]*?miniCodeDataUrl: miniCode\.miniCodeDataUrl/);
  assert.match(editor, /homeTopicsApi\.uploadTopicImage\(current\.id, file, createOperationId\(\), current\.version\)/);
});

test("cover export uses the confirmed 4:3 canvas and fails when either required font is unavailable", () => {
  assert.match(cover, /const coverWidth = 1200;/);
  assert.match(cover, /const coverHeight = 900;/);
  assert.match(cover, /if \(!loadedTitleFonts\.length \|\| !loadedCopyFonts\.length\)/);
  assert.match(cover, /canvas\.toBlob\(resolve, "image\/jpeg", 0\.94\)/);
});
