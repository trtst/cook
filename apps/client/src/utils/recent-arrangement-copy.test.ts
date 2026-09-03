import assert from "node:assert/strict";
import type { HomeRecentArrangement } from "../apis/home";
import {
  createRecentArrangementCopyPicker,
  recentArrangementActionText,
  recentArrangementHintCopies,
  recentArrangementStatusCopies
} from "./recent-arrangement-copy";

function buildArrangement(overrides: Partial<HomeRecentArrangement> = {}): HomeRecentArrangement {
  return {
    sourceType: "EVENT",
    planItemId: 1,
    planDate: "2026-09-03",
    eventId: 1,
    title: "周四晚饭",
    scheduledAt: "2026-09-03 18:30:00",
    participantCount: 2,
    menuCount: 1,
    gapCount: null,
    status: "EMPTY_MENU",
    ...overrides
  };
}

const picker = createRecentArrangementCopyPicker(() => 0.99);
const arrangement = buildArrangement();

assert.equal(picker.statusText(arrangement), "菜单一片空白");
assert.equal(picker.statusText(arrangement), "菜单一片空白");

assert.equal(picker.hintText(arrangement), "菜单暂空，等你来填");
assert.equal(picker.hintText(arrangement), "菜单暂空，等你来填");

const freshPicker = createRecentArrangementCopyPicker(() => 0);
assert.equal(freshPicker.statusText(arrangement), "菜单还空着呢");
assert.equal(freshPicker.hintText(arrangement), "这顿饭还没有安排菜，先去加点菜吧");

const gapArrangement = buildArrangement({
  eventId: 2,
  gapCount: 3,
  status: "PENDING_SHOPPING"
});
assert.equal(picker.hintText(gapArrangement), "补上这 3 样，厨房就能开工了");
assert.equal(picker.hintText({ ...gapArrangement, gapCount: 2 }), "补上这 2 样，厨房就能开工了");

assert.equal(recentArrangementActionText("EMPTY_MENU"), "去加菜");
assert.equal(recentArrangementActionText("PENDING_CONFIRM"), "确认菜单");
assert.equal(recentArrangementActionText("PENDING_SHOPPING"), "去采购");
assert.equal(recentArrangementActionText("READY_TO_COOK"), "开始做饭");
assert.equal(recentArrangementActionText("TIME_UP_SHARE"), "分享回忆");

assert.equal(recentArrangementStatusCopies.EMPTY_MENU.length, 5);
assert.equal(recentArrangementHintCopies.TIME_UP_SHARE.length, 7);
