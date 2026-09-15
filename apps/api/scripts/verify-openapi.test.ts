import assert from "node:assert/strict";
import test from "node:test";

test("permits only explicitly declared binary image responses", async () => {
  const { validateOpenApiDocument } = await import("./verify-openapi");
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

test("rejects a binary response without an explicit binary schema", async () => {
  const { validateOpenApiDocument } = await import("./verify-openapi");

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
