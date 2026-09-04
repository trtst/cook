const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { hasServerEntry, jsStamp } = require("./dev-api-stamp.cjs");

test("jsStamp returns 0 when dist is temporarily missing", () => {
  const missingDir = path.join(os.tmpdir(), `cook-api-missing-${process.pid}-${Date.now()}`);

  assert.equal(jsStamp(missingDir), 0);
});

test("jsStamp returns 0 when dist is deleted during a scan", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cook-api-race-"));
  const originalReaddirSync = fs.readdirSync;
  const error = new Error("missing");
  error.code = "ENOENT";

  fs.readdirSync = () => {
    throw error;
  };

  try {
    assert.equal(jsStamp(root), 0);
  } finally {
    fs.readdirSync = originalReaddirSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("jsStamp returns the newest JavaScript mtime recursively", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cook-api-stamp-"));
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);

  const olderFile = path.join(root, "older.js");
  const ignoredFile = path.join(root, "newer.txt");
  const newerFile = path.join(nested, "newer.js");
  fs.writeFileSync(olderFile, "module.exports = 1;\n");
  fs.writeFileSync(ignoredFile, "ignored\n");
  fs.writeFileSync(newerFile, "module.exports = 2;\n");

  const older = new Date("2026-01-01T00:00:00.000Z");
  const ignored = new Date("2026-01-03T00:00:00.000Z");
  const newer = new Date("2026-01-02T00:00:00.000Z");
  fs.utimesSync(olderFile, older, older);
  fs.utimesSync(ignoredFile, ignored, ignored);
  fs.utimesSync(newerFile, newer, newer);

  assert.equal(jsStamp(root), newer.getTime());

  fs.rmSync(root, { recursive: true, force: true });
});

test("hasServerEntry only accepts an existing main.js", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cook-api-entry-"));
  const entry = path.join(root, "main.js");

  assert.equal(hasServerEntry(root), false);

  fs.writeFileSync(entry, "require('./bootstrap');\n");

  assert.equal(hasServerEntry(root), true);

  fs.rmSync(root, { recursive: true, force: true });
});
