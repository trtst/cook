import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "Layout.vue"), "utf8");

assert.ok(
  source.includes(":capsule-guard=\"navbarCapsuleGuard\""),
  "Expected Layout to pass explicit navbar capsule guard to NavBar."
);
assert.ok(
  source.includes(':custom-center="true"'),
  "Expected Layout to tell NavBar explicitly when navbar-center owns the title area."
);
assert.ok(!source.includes(":left-content="), "Expected Layout not to pass left slot state into NavBar.");
assert.ok(!source.includes(":right-content="), "Expected Layout not to pass right slot state into NavBar.");
assert.ok(!source.includes("navbar-left"), "Expected Layout not to expose a custom left navbar slot.");
assert.ok(!source.includes(":layout=\"navbarLayout\""), "Expected Layout not to pass an unused navbar layout prop.");
assert.ok(!source.includes(":side-guard=\"navbarSideGuard\""), "Expected Layout not to pass a separate navbar side guard prop.");
assert.ok(
  source.includes('v-if="showNavbar && navbarCenterVisible && $slots[\'navbar-center\']"'),
  "Expected Layout to create NavBar default content only when navbar-center is present and visible."
);
assert.ok(source.includes('<NavBar v-else-if="showNavbar"'), "Expected Layout to render a no-default-slot NavBar when navbar-center is absent.");
assert.ok(
  !source.includes('<slot v-if="navbarCenterVisible && $slots[\'navbar-center\']" name="navbar-center" />'),
  "Expected Layout not to put a v-if slot node inside NavBar default content."
);
assert.ok(!source.includes("#center"), "Expected Layout not to forward navbar-center through a named center slot.");
assert.ok(!source.includes("#default"), "Expected Layout not to create a default-slot forwarding wrapper.");
assert.ok(source.includes("navbarCapsuleGuard?: boolean;"), "Expected Layout to expose an explicit navbar capsule guard prop.");
assert.ok(source.includes("navbarCapsuleGuard: false"), "Expected Layout navbar capsule guard to default to false.");
assert.ok(!source.includes("navbarLayout?:"), "Expected Layout not to expose unused navbar layout prop.");
assert.ok(!source.includes("navbarLayout:"), "Expected Layout not to default unused navbar layout prop.");
assert.ok(!source.includes("navbarSideGuard?: boolean;"), "Expected Layout not to expose separate navbar side guard prop.");
assert.ok(!source.includes("navbarSideGuard:"), "Expected Layout not to default separate navbar side guard prop.");
assert.ok(source.includes("navbarCenterVisible?: boolean;"), "Expected Layout to expose explicit navbar center visibility.");
assert.ok(source.includes("navbarCenterVisible: true"), "Expected Layout navbar center visibility to default to true.");

console.log("layout navbar style passed");
