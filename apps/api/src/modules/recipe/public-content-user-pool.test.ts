import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  isPublicInspirationRecipe,
  pickPublicContentOwnerId,
  publicContentUserPoolSize
} from "./public-content-user-pool";
import {
  assertPublicContentUserProfiles,
  buildPoolPlan,
  missingPublicContentUserProfiles,
  type PublicContentUserProfile,
  publicContentUserProfiles
} from "./public-content-user-profiles";

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

test("uses one fixed 100-user profile list with varied 2-to-6-character Chinese nicknames", () => {
  assert.equal(publicContentUserProfiles.length, 100);
  assert.equal(new Set(publicContentUserProfiles.map(item => item.uid)).size, 100);
  assert.equal(new Set(publicContentUserProfiles.map(item => item.nickname)).size, 100);

  const nicknameLengthCounts = publicContentUserProfiles.slice(1).reduce<Record<number, number>>((counts, item) => {
    assert.match(item.nickname, /^\p{Script=Han}{2,6}$/u);
    assert.equal(item.nickname.includes("炊火"), false);
    const length = Array.from(item.nickname).length;
    counts[length] = (counts[length] ?? 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(nicknameLengthCounts, { 2: 20, 3: 20, 4: 20, 5: 20, 6: 19 });
});

test("fills an incomplete pool from the fixed Chinese profiles instead of generic users", () => {
  const missing = missingPublicContentUserProfiles([{ uid: 10001 }]);

  assert.equal(missing.length, 99);
  assert.equal(missing.some(item => /^用户\d+$/.test(item.nickname)), false);
  assert.equal(missing.some(item => item.nickname === "清禾"), true);
  assert.equal(missing.some(item => item.nickname === "每顿都有期待"), true);
});

test("reuses the original Chinese-profile users and retires unrelated pool members", () => {
  const plan = buildPoolPlan(
    [
      { id: 1, uid: 10001, nickname: "灵感菜谱库" },
      { id: 2, uid: 18584731, nickname: "清风小灶" },
      { id: 3, uid: 35808947, nickname: "用户4414258408" }
    ],
    [1, 3]
  );

  assert.deepEqual(plan.createProfiles.length, 98);
  assert.deepEqual(plan.nicknameUpdates, [{ id: 2, nickname: "清禾" }]);
  assert.deepEqual(plan.outgoingUserIds, [3]);
});

test("rejects invalid public-content profile definitions", () => {
  const invalidProfiles: PublicContentUserProfile[] = publicContentUserProfiles.map(item => ({ ...item }));
  invalidProfiles[1] = { ...invalidProfiles[1]!, nickname: "用户1234567890" };

  assert.throws(
    () => assertPublicContentUserProfiles(invalidProfiles),
    /昵称必须为 2 至 6 个中文字符/
  );
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

test("bootstrap restores the fixed Chinese profiles without generating another user batch", () => {
  assert.match(bootstrapSource, /publicContentUserProfiles/);
  assert.match(bootstrapSource, /buildPoolPlan/);
  assert.doesNotMatch(bootstrapSource, /function randomUid/);
  assert.doesNotMatch(bootstrapSource, /function randomNickname/);
  assert.doesNotMatch(bootstrapSource, /`用户\$\{randomInt/);
});

test("system recipe catalog picks its owner from the public-content pool", () => {
  assert.match(seedSource, /pickPublicContentOwnerId\(poolMembers\.map\(item => item\.userId\)\)/);
  assert.doesNotMatch(seedSource, /syncSystemRecipeCatalog\(\) \{[\s\S]*findFirstOrThrow\(\{ where: \{ status: "ACTIVE" \}/);
});
