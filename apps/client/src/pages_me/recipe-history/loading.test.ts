import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const start = source.indexOf("async function loadPage(");
const end = source.indexOf("\nfunction handleScrollToLower", start);
const script = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;

function historyItem(id: string, isAvailable: boolean) {
  return { id, isAvailable };
}

function setup(pages: Array<Array<ReturnType<typeof historyItem>>>) {
  const state = {
    sessionStore: { isLoggedIn: true },
    items: { value: [] as Array<ReturnType<typeof historyItem>> },
    loading: { value: false },
    loadingMore: { value: false },
    loaded: { value: false },
    errorText: { value: "" },
    page: { value: 1 },
    pageSize: { value: 20 },
    hasNext: { value: false },
    loadedMoreOnce: { value: false },
    recipeApi: {
      async listRecipeViewHistory(query: { page: number }) {
        assert.ok(query.page <= pages.length, "must stop at the last page");
        return { items: pages[query.page - 1], page: query.page, pageSize: 20, hasNext: query.page < pages.length };
      }
    }
  };
  const loadPage = new Function(...Object.keys(state), `${script}; return loadPage;`)(...Object.values(state));
  return { state, loadPage };
}

test("recent history hides unavailable recipes on initial and subsequent pages", async () => {
  const { state, loadPage } = setup([
    [historyItem("gone", false), historyItem("first", true)],
    [historyItem("also-gone", false), historyItem("second", true)]
  ]);
  await loadPage(true);
  assert.deepEqual(state.items.value.map(item => item.id), ["first"]);
  await loadPage(false);
  assert.deepEqual(state.items.value.map(item => item.id), ["first", "second"]);
  assert.equal(state.hasNext.value, false);
});

test("an unavailable-only page does not hide available recipes on a later page", async () => {
  const { state, loadPage } = setup([[historyItem("gone", false)], [historyItem("visible", true)]]);
  await loadPage(true);
  assert.deepEqual(state.items.value.map(item => item.id), ["visible"]);
  assert.equal(state.page.value, 2);
});

test("fully unavailable history settles into an empty state", async () => {
  const { state, loadPage } = setup([[historyItem("gone", false)], [historyItem("also-gone", false)]]);
  await loadPage(true);
  assert.deepEqual(state.items.value, []);
  assert.equal(state.hasNext.value, false);
  assert.equal(state.loading.value, false);
  assert.equal(state.loaded.value, true);
});

test("failed history requests finish the initial skeleton and allow retry", async () => {
  const { state, loadPage } = setup([[]]);
  const request = state.recipeApi.listRecipeViewHistory;
  state.recipeApi.listRecipeViewHistory = async () => { throw new Error("网络暂时不可用"); };
  assert.equal(await loadPage(true), false);
  assert.equal(state.errorText.value, "网络暂时不可用");
  assert.equal(state.loading.value, false);
  assert.equal(state.loaded.value, true);
  state.recipeApi.listRecipeViewHistory = request;
  assert.equal(await loadPage(true), true);
  assert.equal(state.errorText.value, "");
});
