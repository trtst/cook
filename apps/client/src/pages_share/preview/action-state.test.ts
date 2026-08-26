import assert from "node:assert/strict";
import { resolveSharePreviewActionState } from "./action-state";

const retryState = resolveSharePreviewActionState({
  isLoggedIn: true,
  viewer: null,
  viewerLoading: false,
  viewerFailed: true,
  submitting: false
});

assert.equal(retryState.action, "RETRY");
assert.equal(retryState.label, "重试加载");
assert.equal(retryState.disabled, false);

const pendingState = resolveSharePreviewActionState({
  isLoggedIn: true,
  viewer: null,
  viewerLoading: false,
  viewerFailed: false,
  submitting: false
});

assert.equal(pendingState.action, "PENDING");
assert.equal(pendingState.label, "加载中...");
assert.equal(pendingState.disabled, true);

const loginState = resolveSharePreviewActionState({
  isLoggedIn: false,
  viewer: null,
  viewerLoading: false,
  viewerFailed: false,
  submitting: false
});

assert.equal(loginState.action, "LOGIN");
assert.equal(loginState.label, "登录查看");
assert.equal(loginState.disabled, false);

console.log("share preview action-state tests passed");
