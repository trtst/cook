import assert from "node:assert/strict";
import test from "node:test";
import { validateOpenApiDocument } from "./verify-openapi";

test("permits only explicitly declared binary image responses", () => {
  const result = validateOpenApiDocument({
    components: { schemas: {} },
    paths: {
      "/api/admin/recipe-images/temp/{tempKey}": {
        get: {
          responses: {
            "200": {
              content: {
                "image/jpeg": { schema: { type: "string", format: "binary" } },
                "image/png": { schema: { type: "string", format: "binary" } },
                "image/webp": { schema: { type: "string", format: "binary" } }
              }
            }
          }
        }
      }
    }
  });

  assert.deepEqual(result, { operationCount: 1, responseSchemaCount: 0 });
});

test("rejects a binary response without an explicit binary schema", () => {
  assert.throws(
    () => validateOpenApiDocument({
      components: { schemas: {} },
      paths: {
        "/api/admin/recipe-images/temp/{tempKey}": {
          get: {
            responses: { "200": { content: { "image/png": {} } } }
          }
        }
      }
    }),
    /binary response must declare an image content type and binary schema/
  );
});

function documentFor(summaryModel: string, cookingModel = "CookingTraceResponseModel") {
  return {
    paths: {
      "/api/fridge-traces/summary": {
        get: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["data"],
                    properties: { data: { $ref: `#/components/schemas/${summaryModel}` } }
                  }
                }
              }
            }
          }
        }
      },
      "/api/meal-plans/{planItemId}/cooking-complete": {
        post: {
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["data"],
                    properties: { data: { $ref: `#/components/schemas/${cookingModel}` } }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        FridgeTraceModel: { type: "object", properties: { id: { type: "string" } } },
        FridgeTraceSummaryResponseModel: {
          type: "object",
          required: ["totalCount", "latestTime"],
          properties: { totalCount: { type: "integer" }, latestTime: { type: "string", nullable: true } }
        },
        CookingTraceResponseModel: {
          type: "object",
          properties: { planItemId: { type: "integer" }, recordedAt: { type: "string" }, usedCount: { type: "integer" }, message: { type: "string" } }
        },
        CookingConsumptionResponseModel: { type: "object", properties: { canUndo: { type: "boolean" } } }
      }
    }
  };
}

test("OpenAPI 冰箱摘要必须声明与实际回包匹配的模型", () => {
  assert.throws(
    () => validateOpenApiDocument(documentFor("FridgeTraceModel")),
    /fridge-traces\/summary.*FridgeTraceSummaryResponseModel/
  );
  assert.doesNotThrow(() => validateOpenApiDocument(documentFor("FridgeTraceSummaryResponseModel")));
});

test("OpenAPI 做饭完成必须声明痕迹响应模型", () => {
  assert.throws(
    () => validateOpenApiDocument(documentFor("FridgeTraceSummaryResponseModel", "CookingConsumptionResponseModel")),
    /cooking-complete.*CookingTraceResponseModel/
  );
  assert.doesNotThrow(() => validateOpenApiDocument(documentFor("FridgeTraceSummaryResponseModel")));
});
