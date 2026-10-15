import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const viewOpeningTag = (page: string, condition: RegExp) =>
  page.match(/<view\b[^>]*>/g)?.find(tag => condition.test(tag));

test("topic loading and all revised error nodes use the shared centering classes", () => {
  const loadingPages: Array<[string, RegExp]> = [
    ["./pages_home/table-topic-detail/index.vue", /\bv-if="loading/],
    ["./pages_home/table-topic/index.vue", /\bv-if="loading/],
    ["./pages_home/topic-list/index.vue", /\bv-if="loading/],
    ["./pages_home/topic/index.vue", /\bv-if="loading/]
  ];

  for (const [path, condition] of loadingPages) {
    const page = source(path);
    const loadingState = viewOpeningTag(page, condition);
    assert.ok(loadingState, `${path} should have a loading state node`);
    assert.match(loadingState!, /class="[^"]*page-state--centered/, `${path} loading node should be centered`);
  }

  const errorPages = [
    "./pages_home/table-topic-detail/index.vue",
    "./pages_home/table-topic/index.vue",
    "./pages_home/topic-list/index.vue",
    "./pages_home/topic/index.vue",
    "./pages_me/knowledge-detail/index.vue",
    "./pages_me/official-message/index.vue"
  ];
  for (const path of errorPages) {
    const errorState = viewOpeningTag(source(path), /v-else-if="[^"]*errorText/);
    assert.ok(errorState, `${path} should have an error state node`);
    assert.match(errorState!, /class="[^"]*page-state--centered/, `${path} error node should be centered`);
    assert.match(errorState!, /class="[^"]*page-state--error/, `${path} error node should use the shared error icon`);
  }

  const layout = source("./styles/layout.scss");
  assert.match(layout, /\.page-state--centered\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*100vh;/);
});

test("all revised error states use the shared icon and font mapping", () => {
  const errorPages = [
    "./pages_meal/assistant/index.vue",
    "./pages_meal/cook-mode/index.vue",
    "./pages_recipe/assistant/index.vue",
    "./pages_recipe/crop/index.vue"
  ];

  for (const path of errorPages) {
    const errorState = viewOpeningTag(source(path), /v-else-if="[^"]*error/);
    assert.ok(errorState, `${path} should have an error state node`);
    assert.match(errorState!, /class="[^"]*page-state--error/, `${path} error node should use the shared icon`);
  }

  assert.match(source("./styles/layout.scss"), /\.page-state--error::before[\s\S]*?content:\s*"\\e61b";/);
  assert.match(source("./assets/fonts/font.scss"), /\.icon-network-error::before\s*\{\s*content:\s*"\\e61b";/);
});
