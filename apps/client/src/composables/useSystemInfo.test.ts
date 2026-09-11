import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import * as vue from "vue";
import { isRecord } from "../utils/utils";

const source = readFileSync(resolve(__dirname, "useSystemInfo.ts"), "utf8");
const script = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const key = "cook_meal_system_info_snapshot";
const windowInfo = { statusBarHeight: 44, windowWidth: 390, windowHeight: 844 };

function setup(storage = new Map<string, unknown>(), fail = false) {
  const calls = { window: 0, menu: 0, write: 0 };
  const uniPlatform = {
    storage: {
      getSync: (name: string) => storage.get(name),
      setSync(name: string, value: unknown) {
        calls.write++;
        storage.set(name, value);
      }
    },
    system: {
      getWindowInfo() {
        calls.window++;
        if (fail) throw new Error("window info unavailable");
        return windowInfo;
      },
      getMenuButtonRect() {
        calls.menu++;
        return null;
      }
    }
  };
  const exports = {} as typeof import("./useSystemInfo");
  new Function("require", "exports", script)((name: string) => {
    if (name === "vue") return vue;
    if (name === "@/utils/utils") return { isRecord };
    if (name === "@/platform/uni") return { APP_STORAGE_KEYS: { systemInfoSnapshot: key }, uniPlatform };
    throw new Error(`Unexpected import: ${name}`);
  }, exports);
  return { api: exports, calls, storage };
}

test("a valid persisted snapshot supplies layout without querying or rewriting device info", () => {
  const storage = new Map<string, unknown>([[key, {
    statusBarHeight: 24, windowWidth: 375, windowHeight: 812, updatedAt: 1
  }]]);
  const { api, calls } = setup(storage);
  const state = api.useSystemInfo();
  assert.equal(state.systemInfo.value.windowWidth, 375);
  assert.equal(state.navBarTotalHeight.value, 68);
  assert.deepEqual(calls, { window: 0, menu: 0, write: 0 });
});

test("missing cache is captured once and reused by later pages and a fresh launch", () => {
  const { api, calls, storage } = setup();
  api.initSystemInfo();
  api.useSystemInfo();
  api.initSystemInfo();
  assert.deepEqual(calls, { window: 1, menu: 1, write: 1 });
  const restarted = setup(storage);
  assert.equal(restarted.api.useSystemInfo().systemInfo.value.windowHeight, 844);
  assert.deepEqual(restarted.calls, { window: 0, menu: 0, write: 0 });
});

test("invalid dimensions are replaced by a valid device snapshot", () => {
  const storage = new Map<string, unknown>([[key, { windowWidth: -1, windowHeight: 812 }]]);
  const { api, calls } = setup(storage);
  assert.equal(api.useSystemInfo().systemInfo.value.windowWidth, 390);
  assert.deepEqual(calls, { window: 1, menu: 1, write: 1 });
});

test("failed device reads do not persist fallback dimensions", () => {
  const { api, storage } = setup(new Map(), true);
  assert.equal(api.useSystemInfo().navBarTotalHeight.value, 64);
  assert.equal(storage.has(key), false);
});
