import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, "index.vue"), "utf8");

assert.doesNotMatch(source, /knowledgeApi\.listArticles/u);
assert.doesNotMatch(source, /loadKnowledgeChannels/u);
