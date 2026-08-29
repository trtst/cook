import assert from "node:assert/strict";
import { buildThemePageStyle } from "./theme-page-style";

assert.equal(
  buildThemePageStyle({
    "--color-page": "#ffffff"
  }),
  "overflow: visible; background-color: #ffffff;"
);

assert.equal(
  buildThemePageStyle(
    {
      "--color-page": "#111715"
    },
    "overflow: hidden;"
  ),
  "overflow: hidden; background-color: #111715;"
);

assert.equal(buildThemePageStyle({}), "overflow: visible;");

console.log("theme page-style tests passed");
