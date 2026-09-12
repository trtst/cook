import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  isPublicInspirationRecipe,
  pickPublicContentOwnerId,
  publicContentUserPoolSize
} from "./public-content-user-pool";

const adminServiceSource = readFileSync(resolve(__dirname, "../admin/admin.service.ts"), "utf8");
const bootstrapSource = readFileSync(resolve(__dirname, "../../../scripts/ensure-recipe-inspiration-owner-pool.ts"), "utf8");
const seedSource = readFileSync(resolve(__dirname, "../../../prisma/seed.ts"), "utf8");

test("only selects from an exactly 100-member public-content user pool", () => {
  const ownerIds = Array.from({ length: publicContentUserPoolSize }, (_, index) => index + 1);
  const selected = pickPublicContentOwnerId(ownerIds);
  assert.equal(ownerIds.includes(selected), true);
});

test("rejects a missing or oversized public-content user pool", () => {
  assert.throws(() => pickPublicContentOwnerId([1]), /正好包含 100 个用户/);
  assert.throws(() => pickPublicContentOwnerId(Array.from({ length: 101 }, (_, index) => index + 1)), /正好包含 100 个用户/);
});

test("rejects a public-content user pool with duplicate user IDs", () => {
  const ownerIds = Array.from({ length: publicContentUserPoolSize }, (_, index) => index + 1);
  ownerIds[ownerIds.length - 1] = ownerIds[ownerIds.length - 2] as number;

  assert.throws(() => pickPublicContentOwnerId(ownerIds), /100 个不同用户/);
});

test("classifies only marked categorized recipes as public inspiration", () => {
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: 1, status: "ACTIVE" }), true);
  assert.equal(isPublicInspirationRecipe({ isInspiration: false, inspirationCategoryId: 1, status: "ACTIVE" }), false);
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: null, status: "ACTIVE" }), false);
  assert.equal(isPublicInspirationRecipe({ isInspiration: true, inspirationCategoryId: 1, status: "BLOCKED" }), false);
});

test("does not allow an admin to disable a public-content pool member", () => {
  assert.match(
    adminServiceSource,
    /body\.status === "DISABLED" && current\.publicContentPoolMember[\s\S]*公共内容用户池成员不能禁用/
  );
});

test("bootstrap removes inactive members before restoring the active pool", () => {
  assert.match(
    bootstrapSource,
    /publicContentUserPoolMember\.deleteMany\(\{\s*where:\s*\{\s*user:\s*\{\s*status:\s*\{\s*not:\s*"ACTIVE"\s*\}/s
  );
});

test("system recipe catalog picks its owner from the public-content pool", () => {
  assert.match(seedSource, /pickPublicContentOwnerId\(poolMembers\.map\(item => item\.userId\)\)/);
  assert.doesNotMatch(seedSource, /syncSystemRecipeCatalog\(\) \{[\s\S]*findFirstOrThrow\(\{ where: \{ status: "ACTIVE" \}/);
});
