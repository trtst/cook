#!/usr/bin/env node

const { readdirSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const env = { ...process.env, TZ: "UTC" };

function listFiles(directory, accept) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") continue;

    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(filePath, accept));
    else if (entry.isFile() && accept(filePath)) files.push(filePath);
  }

  return files.sort();
}

function run(label, command, args) {
  console.log(`\n[gate:ci] ${label}`);
  const result = spawnSync(command, args, { cwd: rootDir, env, stdio: "inherit" });

  if (result.error) {
    console.error(`[gate:ci] Could not start ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[gate:ci] Failed: ${label} (exit ${result.status ?? result.signal})`);
    process.exit(result.status ?? 1);
  }
}

const allAppTestFiles = listFiles(path.join(rootDir, "apps"), filePath => /\.test\.(?:cjs|js|ts)$/.test(filePath));
// New suites run by default. Keep only reviewed API/WeChat DevTools suites on this explicit skip list.
const skippedExternalRuntimeTestPaths = new Set([
  "apps/client/src/pages/home/index.test.js",
  "apps/client/src/pages/home/theme.test.js",
  "apps/client/src/pages/me/index.test.js",
  "apps/client/src/pages/recipe/index.test.js",
  "apps/client/src/pages/recipe/theme.test.js",
  "apps/client/src/pages_home/table-topic/index.test.js",
  "apps/client/src/pages_home/table-topic-detail/index.test.js",
  "apps/client/src/pages_home/topic/index.test.js",
  "apps/client/src/pages_me/account/index.test.js",
  "apps/client/src/pages_me/ingredient-units/index.test.js",
  "apps/client/src/pages_me/knowledge-detail/index.test.js",
  "apps/client/src/pages_me/knowledge-list/index.test.js",
  "apps/client/src/pages_me/medal/index.test.js",
  "apps/client/src/pages_me/medal-detail/index.test.js",
  "apps/client/src/pages_me/official-message/index.test.js",
  "apps/client/src/pages_me/recipe-history/index.test.js",
  "apps/client/src/pages_me/recommend/index.test.js",
  "apps/client/src/pages_me/recommend-detail/index.test.js",
  "apps/client/src/pages_me/reminder/index.test.js",
  "apps/client/src/pages_me/theme/index.test.js",
  "apps/client/src/pages_me/theme/visual-capture.test.js",
  "apps/client/src/pages_meal/plan/index.test.js",
  "apps/client/src/pages_meal/random/index.test.js",
  "apps/client/src/pages_meal/random/theme.test.js",
  "apps/client/src/pages_pantry/gap/index.test.js",
  "apps/client/src/pages_pantry/index/index.test.js",
  "apps/client/src/pages_pantry/list/index.test.js",
  "apps/client/src/pages_pantry/list-detail/index.test.js",
  "apps/client/src/pages_share/import/index.test.js"
]);
const discoveredTestPaths = new Set(
  allAppTestFiles.map(filePath => path.relative(rootDir, filePath).split(path.sep).join("/"))
);
const staleExternalRuntimeTestPaths = [...skippedExternalRuntimeTestPaths].filter(filePath => !discoveredTestPaths.has(filePath));

if (staleExternalRuntimeTestPaths.length > 0) {
  console.error(`[gate:ci] Configured integration tests were not found: ${staleExternalRuntimeTestPaths.join(", ")}`);
  process.exit(1);
}

const externalRuntimeTestFiles = allAppTestFiles.filter(filePath =>
  skippedExternalRuntimeTestPaths.has(path.relative(rootDir, filePath).split(path.sep).join("/"))
);
const appTestFiles = allAppTestFiles.filter(
  filePath => !skippedExternalRuntimeTestPaths.has(path.relative(rootDir, filePath).split(path.sep).join("/"))
);
const shellTestFiles = listFiles(path.join(rootDir, "scripts"), filePath => filePath.endsWith(".test.sh"));

if (appTestFiles.length === 0 && shellTestFiles.length === 0) {
  console.error("[gate:ci] No automated test files were found.");
  process.exit(1);
}

run("All-app type check", "pnpm", ["type-check"]);
run("Client lint", "pnpm", ["--filter", "@next-meal/client", "lint"]);

if (externalRuntimeTestFiles.length > 0) {
  console.log(
    `[gate:ci] Skipping ${externalRuntimeTestFiles.length} configured API/WeChat DevTools integration test files; run them separately with isolated test data and runtime:`
  );
  for (const filePath of externalRuntimeTestFiles) {
    console.log(`  - ${path.relative(rootDir, filePath).split(path.sep).join("/")}`);
  }
}

for (const filePath of shellTestFiles) {
  run(`Shell test: ${path.relative(rootDir, filePath)}`, "bash", [filePath]);
}

const clientTestFiles = appTestFiles.filter(filePath => filePath.startsWith(path.join(rootDir, "apps", "client") + path.sep));
const otherAppTestFiles = appTestFiles.filter(filePath => !clientTestFiles.includes(filePath));

if (otherAppTestFiles.length > 0) {
  run(`Application tests (${otherAppTestFiles.length} files)`, "pnpm", [
    "--filter",
    "@next-meal/api",
    "exec",
    "tsx",
    "--test",
    "--test-reporter=dot",
    ...otherAppTestFiles
  ]);
}

if (clientTestFiles.length > 0) {
  run(`Client tests (${clientTestFiles.length} files)`, "pnpm", [
    "--filter",
    "@next-meal/api",
    "exec",
    "tsx",
    "--tsconfig",
    path.join(rootDir, "apps", "client", "tsconfig.json"),
    "--test",
    "--test-reporter=dot",
    ...clientTestFiles
  ]);
}

run("API OpenAPI contract", "pnpm", ["--filter", "@next-meal/api", "verify:openapi"]);
run("API production build", "pnpm", ["build:api"]);
run("Worker production build", "pnpm", ["build:worker"]);
run("Client production build", "pnpm", ["build:client"]);
run("Admin production build", "pnpm", ["build:admin"]);
run("Site production build", "pnpm", ["build:site"]);

console.log("\n[gate:ci] All automated gates passed.");
