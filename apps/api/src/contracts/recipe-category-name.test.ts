import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { RecipeCategoryNameDto, UpdateRecipeCategoryDto } from "./dtos";

test("personal recipe category names accept eight Chinese characters and reject a ninth", () => {
  const validName = "家常快手周末宴客";
  const tooLongName = "家常快手周末宴客菜";
  const createValid = plainToInstance(RecipeCategoryNameDto, { name: validName });
  const createTooLong = plainToInstance(RecipeCategoryNameDto, { name: tooLongName });
  const updateValid = plainToInstance(UpdateRecipeCategoryDto, { expectedVersion: 1, name: validName });
  const updateTooLong = plainToInstance(UpdateRecipeCategoryDto, { expectedVersion: 1, name: tooLongName });

  assert.equal(validateSync(createValid).length, 0);
  assert.equal(validateSync(updateValid).length, 0);
  assert.equal(validateSync(createTooLong).length, 1);
  assert.equal(validateSync(updateTooLong).length, 1);
});
