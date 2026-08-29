import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSkinFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected skin file to include: ${snippet}`);
}

const boldContrastSkin = readSkinFile("./bold-contrast/skins.scss");

expectIncludes(boldContrastSkin, "--button-primary-shadow: 0 3rpx 10rpx rgba(0, 0, 0, 0.08);");
expectIncludes(boldContrastSkin, "--shadow-card: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);");
expectIncludes(boldContrastSkin, "--shadow-floating: 0 -2rpx 8rpx rgba(0, 0, 0, 0.04);");
expectIncludes(boldContrastSkin, "--shadow-tabbar: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);");
expectIncludes(boldContrastSkin, "--button-primary-shadow: 0 3rpx 10rpx rgba(0, 0, 0, 0.14);");
expectIncludes(boldContrastSkin, "--shadow-card: 0 2rpx 8rpx rgba(0, 0, 0, 0.12);");
expectIncludes(boldContrastSkin, "--shadow-floating: 0 -2rpx 8rpx rgba(0, 0, 0, 0.16);");
expectIncludes(boldContrastSkin, "--shadow-tabbar: 0 2rpx 8rpx rgba(0, 0, 0, 0.12);");

console.log("theme skin shadow tests passed");
