const fs = require("node:fs");
const path = require("node:path");

function isMissing(error) {
  return error && error.code === "ENOENT";
}

function jsStamp(directory) {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  let stamp = 0;
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) {
      return 0;
    }
    throw error;
  }

  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      stamp = Math.max(stamp, jsStamp(file));
    } else if (entry.name.endsWith(".js")) {
      try {
        stamp = Math.max(stamp, fs.statSync(file).mtimeMs);
      } catch (error) {
        if (!isMissing(error)) {
          throw error;
        }
      }
    }
  }
  return stamp;
}

function hasServerEntry(directory) {
  return fs.existsSync(path.join(directory, "main.js"));
}

module.exports = { hasServerEntry, jsStamp };
