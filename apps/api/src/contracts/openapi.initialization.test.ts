import assert from "node:assert/strict";
import test from "node:test";

test("compiled OpenAPI models load without forward-reference initialization errors", async () => {
  const compiledOpenApi = "../../dist/contracts/openapi.js";
  await assert.doesNotReject(import(compiledOpenApi));
});
