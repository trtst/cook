import assert from "node:assert/strict";
import test from "node:test";
import { isLocalAssetReference } from "./admin-system-data-snapshot.service";

test("treats another environment path on the same asset host as an external URL", () => {
  const previousBase = process.env.ASSET_PUBLIC_BASE_URL;
  process.env.ASSET_PUBLIC_BASE_URL = "https://static.trtst.com/dev";

  try {
    assert.equal(
      isLocalAssetReference("https://static.trtst.com/O/uploads/admin-recipe-images/cover.jpg"),
      false
    );
    assert.equal(
      isLocalAssetReference("https://static.trtst.com/dev/uploads/admin-recipe-images/cover.jpg"),
      true
    );
  } finally {
    if (previousBase === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    else process.env.ASSET_PUBLIC_BASE_URL = previousBase;
  }
});
