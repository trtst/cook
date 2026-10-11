import assert from "node:assert/strict";
import {
  assertRecipeMigrationTarget,
  parseRecipeMigrationTarget,
  recipeMigrationFingerprint
} from "./recipe-migration-target";

const testEnvironment = {
  DATABASE_URL: "postgresql://localhost:5432/cook_test",
  SYSTEM_DATA_ENVIRONMENT: "TEST",
  ASSET_STORAGE_DRIVER: "oss",
  ASSET_STORAGE_PREFIX: "dev",
  OSS_REGION: "oss-cn-test",
  OSS_BUCKET: "cook-test",
  OSS_ENDPOINT: "https://oss-test.example"
};

assert.equal(parseRecipeMigrationTarget(["--target=TEST"]), "TEST");
assert.throws(() => parseRecipeMigrationTarget([]), /必须指定 --target/);
assert.throws(() => parseRecipeMigrationTarget(["--target=STAGING"]), /必须指定 --target/);

assert.doesNotThrow(() => assertRecipeMigrationTarget("TEST", false, testEnvironment, []));
assert.throws(
  () => assertRecipeMigrationTarget("ONLINE", false, testEnvironment, []),
  /SYSTEM_DATA_ENVIRONMENT 必须为 ONLINE/
);
assert.throws(
  () => assertRecipeMigrationTarget("TEST", true, { ...testEnvironment, ASSET_STORAGE_PREFIX: "prod" }, []),
  /TEST 目标的 OSS 前缀必须为 dev/
);
assert.throws(
  () => assertRecipeMigrationTarget("ONLINE", true, {
    ...testEnvironment,
    SYSTEM_DATA_ENVIRONMENT: "ONLINE",
    ASSET_STORAGE_PREFIX: "prod"
  }, []),
  /线上写入需要显式添加 --confirm-online-write/
);
assert.doesNotThrow(() => assertRecipeMigrationTarget("ONLINE", true, {
  ...testEnvironment,
  SYSTEM_DATA_ENVIRONMENT: "ONLINE",
  ASSET_STORAGE_PREFIX: "prod"
}, ["--confirm-online-write"]));

assert.throws(() => recipeMigrationFingerprint({}), /DATABASE_URL 未配置/);
const fingerprint = recipeMigrationFingerprint(testEnvironment);
assert.notEqual(fingerprint, recipeMigrationFingerprint({ ...testEnvironment, DATABASE_URL: "postgresql://localhost:5432/other" }));
assert.notEqual(fingerprint, recipeMigrationFingerprint({ ...testEnvironment, ASSET_STORAGE_PREFIX: "other" }));
assert.notEqual(fingerprint, recipeMigrationFingerprint({ ...testEnvironment, OSS_ENDPOINT: "https://oss-other.example" }));
assert.notEqual(fingerprint, recipeMigrationFingerprint({ ...testEnvironment, ASSET_PUBLIC_BASE_URL: "https://other.example" }));

console.log("recipe migration target tests passed");
