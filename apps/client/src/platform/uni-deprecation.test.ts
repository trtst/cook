import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const platformSource = readFileSync(resolve(__dirname, "uni.ts"), "utf8");
const requestAdapterSource = readFileSync(resolve(__dirname, "../apis/adapters/uni.ts"), "utf8");

assert.ok(platformSource.includes("getFileSystemManager"), "Expected file save to use the WeChat file system manager.");
assert.ok(!platformSource.includes("uni.saveFile("), "Expected platform media save not to call deprecated uni.saveFile.");
assert.ok(requestAdapterSource.includes("getDeviceInfo"), "Expected request adapter platform detection to use getDeviceInfo.");
assert.ok(!requestAdapterSource.includes("getSystemInfoSync"), "Expected request adapter not to call deprecated getSystemInfoSync.");

console.log("platform deprecation checks passed");
