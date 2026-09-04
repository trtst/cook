import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const toastComponentSource = readFileSync(resolve(__dirname, "./Toast.vue"), "utf8");
const toastStateSource = readFileSync(resolve(__dirname, "../../feedback/toast.ts"), "utf8");

test("toast placement defaults to top and can be set to bottom", () => {
  assert.match(toastStateSource, /placement\?: ToastPlacement/);
  assert.match(toastStateSource, /type ToastPlacement = "top" \| "bottom"/);
  assert.match(toastStateSource, /placement: "top"/);
  assert.match(toastStateSource, /const placement = options\.placement \?\? "top"/);
  assert.match(toastStateSource, /toastState\.placement = placement/);
  assert.match(toastComponentSource, /toast-layer--\$\{toast\.placement\}/);
});

test("toast keeps top motion and adds bottom slide-up motion with minimum width", () => {
  assert.match(toastComponentSource, /min-width: 400rpx/);
  assert.match(toastComponentSource, /text-align: center/);
  assert.match(toastComponentSource, /\.toast-layer--top \.toast-card/);
  assert.match(toastComponentSource, /translate3d\(0, -18rpx, 0\) scale\(0\.98\)/);
  assert.match(toastComponentSource, /\.toast-layer--bottom \.toast-card/);
  assert.match(toastComponentSource, /translate3d\(0, 28rpx, 0\) scale\(0\.98\)/);
  assert.match(toastComponentSource, /paddingBottom: `calc\(env\(safe-area-inset-bottom\) \+ 32rpx\)`/);
});

console.log("toast contract tests loaded");
