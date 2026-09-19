import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

const detailSource = read("./index.vue");
const privateSheetSource = read("../../components/Recipe/AddToPrivateSheet.vue");
const planSheetSource = read("../../components/Recipe/AddToPlanSheet.vue");

assert.match(
  detailSource,
  /function openLoginForUnauthorized\([\s\S]*?openLogin\(/,
  "recipe detail should route expired sessions to the login modal"
);
assert.match(
  detailSource,
  /cookAssistantSheetError\.value = error instanceof Error \? error\.message :/,
  "ordinary assistant failures should still keep a user-facing fallback"
);
assert.doesNotMatch(
  detailSource,
  /cookAssistantSheetError\.value = error instanceof Error \? error\.message[^\n]*UnauthorizedError/,
  "assistant auth failures must not render UnauthorizedError text"
);
assert.match(
  detailSource,
  /if \(error instanceof UnauthorizedError\) \{[\s\S]*?shoppingListError\.value = ""[\s\S]*?openLoginForUnauthorized\(/,
  "shopping-list auth failures should clear the local error and open login"
);

for (const [name, source] of [
  ["private recipe sheet", privateSheetSource],
  ["plan sheet", planSheetSource]
] as const) {
  assert.match(source, /import \{ UnauthorizedError, type UUID \} from "@\/apis\/http";/, `${name} should classify auth failures`);
  assert.match(source, /import \{ useLoginModalStore \} from "@\/stores\/login-modal";/, `${name} should own login prompting`);
  assert.match(source, /if \(error instanceof UnauthorizedError\) \{[\s\S]*?loginModalStore\.open\(/, `${name} should open login for expired sessions`);
  assert.doesNotMatch(source, /if \(error instanceof UnauthorizedError\) \{[^}]*error\.message/, `${name} must not expose the auth error message`);
}

console.log("recipe auth error handling passed");
