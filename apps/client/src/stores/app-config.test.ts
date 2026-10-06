import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.vue", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../pages/home/index.vue", import.meta.url), "utf8");
const appConfigSource = readFileSync(new URL("./app-config.ts", import.meta.url), "utf8");
const appConfigApiSource = readFileSync(new URL("../apis/app-config.ts", import.meta.url), "utf8");
const loginModalSource = readFileSync(new URL("./login-modal.ts", import.meta.url), "utf8");

test("app config loads on cold launch and refreshes once when home is shown after foreground", () => {
  assert.match(appSource, /useAppConfigStore/);
  assert.match(appSource, /void useAppConfigStore\(\)\.loadOnLaunch\(\)/);
  assert.match(appSource, /useAppConfigStore\(\)\.startForegroundCycle\(\)/);

  assert.match(homeSource, /useAppConfigStore/);
  assert.match(homeSource, /void useAppConfigStore\(\)\.refreshForHomeShow\(\)/);

  assert.match(appConfigSource, /loadOnLaunch\(\)/);
  assert.match(appConfigSource, /startForegroundCycle\(\)/);
  assert.match(appConfigSource, /refreshForHomeShow\(\)/);
});

test("opening the login modal does not request app config", () => {
  assert.doesNotMatch(loginModalSource, /useAppConfigStore/);
  assert.doesNotMatch(loginModalSource, /openImageUrl/);
  assert.doesNotMatch(loginModalSource, /appConfigStore\.load\(/);
  assert.doesNotMatch(loginModalSource, /void appConfigStore\.load/);
});

test("app config keeps cook assistant activity config from the public endpoint", () => {
  assert.match(appConfigApiSource, /interface CookAssistantActivityConfig/);
  assert.match(appConfigApiSource, /activityEnabled: boolean/);
  assert.match(appConfigApiSource, /dailyUnlockLimit: number/);
  assert.match(appConfigApiSource, /tipText: string/);
  assert.match(appConfigApiSource, /cookAssistant: CookAssistantActivityConfig/);

  assert.match(appConfigSource, /cookAssistant:/);
  assert.match(appConfigSource, /config\.cookAssistant/);
  assert.match(appConfigSource, /dailyUnlockLimit/);
});
