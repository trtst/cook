import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ChooseBringRecipeDto, ChooseDiningEventWishRecipeDto } from "../../contracts/dtos";
import { MealService } from "./meal.service";

test("bring and wish DTOs accept one to three unique recipe ids and reject four", async () => {
  const validBring = await validate(plainToInstance(ChooseBringRecipeDto, { recipeIds: [1, 2, 3] }));
  const invalidBring = await validate(plainToInstance(ChooseBringRecipeDto, { recipeIds: [1, 2, 3, 4] }));
  const validWish = await validate(plainToInstance(ChooseDiningEventWishRecipeDto, { recipeIds: [8, 9] }));

  assert.equal(validBring.length, 0);
  assert.ok(invalidBring.length > 0);
  assert.equal(validWish.length, 0);
});

test("dining event summary exposes all participant bring recipes and the participant note", () => {
  const service = new MealService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const summary = (service as any).toDiningEventSummary({
    id: 901,
    userId: 9,
    title: "周末饭局",
    scheduledAt: new Date("2026-10-01T12:00:00.000Z"),
    location: null,
    note: null,
    coverStorageKey: null,
    coverContentType: null,
    updatedAt: new Date("2026-09-19T12:00:00.000Z"),
    status: "PLANNED",
    completedAt: null,
    mealPlanItemId: null,
    diningGroupId: null,
    menuSnapshot: {},
    version: 1,
    createdAt: new Date("2026-09-19T12:00:00.000Z"),
    user: { uid: 90000001, nickname: "主家", avatarUrl: null },
    mealPlanItem: { shoppingList: null },
    shareInvites: [],
    wishItems: [],
    menuItems: [],
    participants: [{
      id: 12,
      user: { uid: 90000002, nickname: "小明", avatarUrl: null },
      guestName: null,
      sourceType: "SHARE",
      status: "ACCEPTED",
      note: "花生过敏；少辣",
      bringRecipes: [
        { recipeId: 1001, recipeVersionId: 2001, recipeVersion: { name: "番茄炒蛋" } },
        { recipeId: 1002, recipeVersionId: 2002, recipeVersion: { name: "清炒青菜" } }
      ]
    }]
  }, 9);

  assert.deepEqual(summary.participants[0].bringRecipes, [
    { recipeId: 1001, recipeVersionId: 2001, title: "番茄炒蛋" },
    { recipeId: 1002, recipeVersionId: 2002, title: "清炒青菜" }
  ]);
  assert.equal(summary.participants[0].note, "花生过敏；少辣");
  assert.equal("bringRecipeId" in summary.participants[0], false);
});

test("participant note endpoint and batch recipe contract are present", () => {
  const controllerSource = readFileSync(resolve(process.cwd(), "src/modules/meal/meal.controller.ts"), "utf8");
  const dtoSource = readFileSync(resolve(process.cwd(), "src/contracts/dtos.ts"), "utf8");

  assert.match(controllerSource, /dining-events\/:eventId\/my-note/);
  assert.match(controllerSource, /updateDiningEventParticipantNote/);
  assert.match(dtoSource, /class UpdateDiningEventParticipantNoteDto/);
  assert.match(controllerSource, /参与人一次选择最多三道菜加入当前饭局的我想吃池/);
  assert.doesNotMatch(controllerSource, /参与人把一道菜加入当前饭局的我想吃池/);
});

test("bring writes enforce event and participant state and recalculate the participant ledger", () => {
  const serviceSource = readFileSync(resolve(process.cwd(), "src/modules/meal/meal.service.ts"), "utf8");
  const start = serviceSource.indexOf("async chooseBringRecipe(");
  const end = serviceSource.indexOf("\n  async completeDiningEvent(", start);
  const methodSource = serviceSource.slice(start, end);

  assert.match(methodSource, /event\.userId === userId/);
  assert.match(methodSource, /event\.status === "CANCELLED"[\s\S]*event\.status === "CONFIRMED"/);
  assert.match(methodSource, /participant\.status !== "INVITED"[\s\S]*participant\.status !== "ACCEPTED"/);
  assert.match(methodSource, /upsertDiningEventParticipantLedger\(/);
  const participantLockIndex = methodSource.indexOf('FROM "dining_event_participants"');
  const participantStatusIndex = methodSource.indexOf('participant.status !== "INVITED"');
  assert.ok(participantLockIndex >= 0 && participantLockIndex < participantStatusIndex, "Participant status must be checked after the row lock");
});

test("participant response and invitation transitions reject stale rows and recalculate dependent state", () => {
  const serviceSource = readFileSync(resolve(process.cwd(), "src/modules/meal/meal.service.ts"), "utf8");
  const respondStart = serviceSource.indexOf("async respondToDiningEvent(");
  const respondEnd = serviceSource.indexOf("\n  async updateDiningEventParticipantNote(", respondStart);
  const respondSource = serviceSource.slice(respondStart, respondEnd);
  assert.match(respondSource, /FROM "dining_event_participants"[\s\S]*FOR UPDATE/);
  assert.match(respondSource, /lockedParticipant\.status === "REMOVED"/);
  assert.match(respondSource, /lockedParticipant\.diningEvent\.status === "CANCELLED"[\s\S]*lockedParticipant\.diningEvent\.status === "COMPLETED"/);
  assert.match(respondSource, /normalizedStatus === "DECLINED"[\s\S]*diningEventParticipantBringRecipe\.deleteMany/);
  assert.match(respondSource, /normalizedStatus === "DECLINED"[\s\S]*diningEventWishSupport\.deleteMany/);
  assert.match(respondSource, /upsertDiningEventParticipantLedger\(/);

  const wishStart = serviceSource.indexOf("async chooseDiningEventWishRecipe(");
  const wishEnd = serviceSource.indexOf("\n  async updateDiningEventWishSupport(", wishStart);
  const wishSource = serviceSource.slice(wishStart, wishEnd);
  assert.match(wishSource, /FROM "dining_event_participants"[\s\S]*FOR UPDATE/);
  assert.match(wishSource, /upsertDiningEventParticipantLedger\(/);

  const supportStart = serviceSource.indexOf("async updateDiningEventWishSupport(");
  const supportEnd = serviceSource.indexOf("\n  async addDiningEventWishToMenu(", supportStart);
  const supportSource = serviceSource.slice(supportStart, supportEnd);
  assert.match(supportSource, /FROM "dining_event_participants"[\s\S]*FOR UPDATE/);
  assert.match(supportSource, /currentCount >= 3/);
  assert.match(supportSource, /upsertDiningEventParticipantLedger\(/);
});

test("participant writes lock the dining event before checking its mutable status", () => {
  const serviceSource = readFileSync(resolve(process.cwd(), "src/modules/meal/meal.service.ts"), "utf8");
  const methods = [
    ["revokeDiningEventParticipantInvite", "reinviteDiningEventParticipant"],
    ["reinviteDiningEventParticipant", "respondToDiningEvent"],
    ["respondToDiningEvent", "updateDiningEventParticipantNote"],
    ["updateDiningEventParticipantNote", "chooseDiningEventWishRecipe"],
    ["chooseDiningEventWishRecipe", "updateDiningEventWishSupport"],
    ["updateDiningEventWishSupport", "addDiningEventWishToMenu"]
  ] as const;

  for (const [name, endName] of methods) {
    const start = serviceSource.indexOf(`async ${name}(`);
    const end = serviceSource.indexOf(`\n  async ${endName}(`, start);
    const methodSource = serviceSource.slice(start, end);
    const lockIndex = methodSource.indexOf('FROM "dining_events"');
    const statusIndex = methodSource.indexOf('.status ===');
    assert.ok(lockIndex >= 0, `${name} must lock its dining event row`);
    assert.ok(lockIndex < statusIndex, `${name} must check event status after locking the event row`);
  }

  const completeStart = serviceSource.indexOf("async completeDiningEvent(");
  const completeEnd = serviceSource.indexOf("\n  async createDiningMemoryShare(", completeStart);
  const completeSource = serviceSource.slice(completeStart, completeEnd);
  assert.match(completeSource, /FROM "dining_events"[\s\S]*FOR UPDATE[\s\S]*loadDiningEventRow/);
});

test("admin recipe-version reference checks use the participant bring table after migration", () => {
  const adminSource = readFileSync(resolve(process.cwd(), "src/modules/admin/admin.service.ts"), "utf8");
  assert.doesNotMatch(adminSource, /FROM "dining_event_participants"[\s\S]{0,120}bring_version_id/);
  assert.match(adminSource, /FROM "dining_event_participant_bring_recipes"/);
  assert.match(adminSource, /"recipe_version_id" AS "version_id"/);
});

test("participant bring uniqueness is based on the fixed recipe version", () => {
  const schemaSource = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.match(schemaSource, /@@unique\(\[participantId, recipeVersionId\]\)/);

  const migrationRoot = resolve(process.cwd(), "prisma/migrations");
  const migrationFiles = readdirSync(migrationRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => resolve(migrationRoot, entry.name, "migration.sql"));
  const migrationSource = migrationFiles
    .map(file => readFileSync(file, "utf8"))
    .join("\n");
  assert.match(migrationSource, /DROP INDEX[\s\S]*dining_event_participant_bring_recipes_participant_id_recipe_id_recipe_version_id_key/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX[\s\S]*dining_event_participant_bring_recipes_participant_id_recipe_version_id_key/);
});
