import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  AdminIngredientModel,
  IngredientModel,
  RecipeAmountModel,
  RecipeDraftIngredientModel,
  RecipeImportIngredientModel,
  RecipeIngredientInputAmountModel,
  UnitModel
} from "./openapi";

@Module({})
class IngredientOpenApiTestModule {}

test("only the Admin ingredient schema permits a missing default unit", async () => {
  const app = await NestFactory.create(IngredientOpenApiTestModule, { logger: false });
  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("ingredient contract test").setVersion("1").build(),
      { extraModels: [IngredientModel, AdminIngredientModel, UnitModel] }
    );
    const schemas = document.components?.schemas as Record<string, { properties?: Record<string, { nullable?: boolean }> }>;

    assert.notEqual(schemas.IngredientModel?.properties?.defaultUnit?.nullable, true);
    assert.equal(schemas.AdminIngredientModel?.properties?.defaultUnit?.nullable, true);
  } finally {
    await app.close();
  }
});

test("recipe import ingredient responses expose nullable system category codes", async () => {
  const app = await NestFactory.create(IngredientOpenApiTestModule, { logger: false });
  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("recipe import ingredient contract test").setVersion("1").build(),
      { extraModels: [RecipeImportIngredientModel] }
    );
    const schemas = document.components?.schemas as Record<string, {
      properties?: Record<string, { nullable?: boolean; enum?: string[] }>;
    }>;
    const categoryCode = schemas.RecipeImportIngredientModel?.properties?.categoryCode;

    assert.equal(categoryCode?.nullable, true);
    assert.deepEqual(categoryCode?.enum, [
      "PRODUCE",
      "MEAT_POULTRY_EGG",
      "SEAFOOD",
      "SOY_DAIRY",
      "GRAINS_STAPLES",
      "SEASONING",
      "DRIED_PRESERVED",
      "BEVERAGE_ALCOHOL",
      "UNCLASSIFIED"
    ]);
  } finally {
    await app.close();
  }
});

test("Admin ingredient responses expose merged status and the active target summary", async () => {
  const app = await NestFactory.create(IngredientOpenApiTestModule, { logger: false });
  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("merged ingredient contract test").setVersion("1").build(),
      { extraModels: [AdminIngredientModel] }
    );
    const schemas = document.components?.schemas as Record<string, {
      properties?: Record<string, { nullable?: boolean; enum?: string[]; allOf?: Array<{ $ref?: string }> }>;
    }>;
    const ingredient = schemas.AdminIngredientModel?.properties;

    assert.deepEqual(ingredient?.status?.enum, ["PENDING", "ACTIVE", "DISABLED", "MERGED"]);
    assert.equal(ingredient?.mergedTo?.nullable, true);
    assert.equal(ingredient?.mergedTo?.allOf?.[0]?.$ref, "#/components/schemas/AdminIngredientMergeTargetModel");
  } finally {
    await app.close();
  }
});

test("merge ingredient input requires a positive target ingredient id and source version", async () => {
  const contracts = await import("./dtos.js") as unknown as Record<string, new () => object>;
  const MergeAdminIngredientDto = contracts.MergeAdminIngredientDto;

  assert.equal(typeof MergeAdminIngredientDto, "function");
  const valid = plainToInstance(MergeAdminIngredientDto, { expectedVersion: 3, targetIngredientId: 10000001 });
  const invalid = plainToInstance(MergeAdminIngredientDto, { expectedVersion: 0, targetIngredientId: 0 });

  assert.equal(validateSync(valid).length, 0);
  assert.equal(validateSync(invalid).length, 2);
});

test("recipe fuzzy amounts only accept and expose 适量", async () => {
  const contracts = await import("./dtos.js") as unknown as Record<string, new () => object>;
  const RecipeAmountDto = contracts.RecipeAmountDto;
  const valid = plainToInstance(RecipeAmountDto, { kind: "FUZZY", text: "适量" });
  const legacyFew = plainToInstance(RecipeAmountDto, { kind: "FUZZY", text: "少许" });
  const legacyNeeded = plainToInstance(RecipeAmountDto, { kind: "FUZZY", text: "按需" });

  assert.equal(validateSync(valid).length, 0);
  assert.equal(validateSync(legacyFew).length, 1);
  assert.equal(validateSync(legacyNeeded).length, 1);

  const app = await NestFactory.create(IngredientOpenApiTestModule, { logger: false });
  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("recipe fuzzy amount contract test").setVersion("1").build(),
      {
        extraModels: [
          RecipeAmountModel,
          RecipeIngredientInputAmountModel,
          RecipeDraftIngredientModel,
          RecipeImportIngredientModel
        ]
      }
    );
    const schemas = document.components?.schemas as Record<string, {
      properties?: Record<string, { enum?: string[] }>;
    }>;

    assert.deepEqual(schemas.RecipeAmountModel?.properties?.text?.enum, ["适量"]);
    assert.deepEqual(schemas.RecipeIngredientInputAmountModel?.properties?.text?.enum, ["适量"]);
    assert.deepEqual(schemas.RecipeDraftIngredientModel?.properties?.fuzzyText?.enum, ["适量"]);
    assert.deepEqual(schemas.RecipeImportIngredientModel?.properties?.fuzzyText?.enum, ["适量"]);
  } finally {
    await app.close();
  }
});

test("client ingredient categories expose their stable code", async () => {
  const { IngredientCategoryModel } = await import("./openapi.js");
  const app = await NestFactory.create(IngredientOpenApiTestModule, { logger: false });
  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("ingredient category contract test").setVersion("1").build(),
      { extraModels: [IngredientCategoryModel] }
    );
    const schemas = document.components?.schemas as Record<string, { properties?: Record<string, unknown> }>;

    assert.equal(Boolean(schemas.IngredientCategoryModel?.properties?.code), true);
  } finally {
    await app.close();
  }
});
