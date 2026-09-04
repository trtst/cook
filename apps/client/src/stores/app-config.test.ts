import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const appSource = readFileSync(resolve(import.meta.dirname, "../App.vue"), "utf8");
const homeSource = readFileSync(resolve(import.meta.dirname, "../pages/home/index.vue"), "utf8");
const appConfigSource = readFileSync(resolve(import.meta.dirname, "./app-config.ts"), "utf8");
const loginModalSource = readFileSync(resolve(import.meta.dirname, "./login-modal.ts"), "utf8");

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
