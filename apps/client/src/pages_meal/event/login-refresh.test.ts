import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.match(source, /import \{ onLoad, onShow \} from "@dcloudio\/uni-app";/);
assert.match(source, /import \{ onLoginSuccess \} from "@\/utils\/session-events";/);
assert.match(source, /const stopLoginSuccess = onLoginSuccess\(\(\) => \{[\s\S]*loadEvents\(\{ reset: true, syncStage: true \}\)/);
assert.match(source, /onBeforeUnmount\(stopLoginSuccess\);/);

console.log("meal event login refresh tests passed");
