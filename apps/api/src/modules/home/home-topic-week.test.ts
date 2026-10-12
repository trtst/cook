import assert from "node:assert/strict";
import test from "node:test";
import { beijingWeekEnd, isoDate, nextBeijingWeekStart } from "./home-topic-week";

test("home topic periods use the next full Beijing week boundary", () => {
  assert.equal(isoDate(nextBeijingWeekStart(new Date("2026-10-12T00:00:00.000Z"))), "2026-10-19");
  assert.equal(isoDate(nextBeijingWeekStart(new Date("2026-10-18T15:59:59.999Z"))), "2026-10-19");
  assert.equal(isoDate(nextBeijingWeekStart(new Date("2026-10-18T16:00:00.000Z"))), "2026-10-26");
  const start = nextBeijingWeekStart(new Date("2026-10-14T04:00:00.000Z"));
  assert.equal(isoDate(beijingWeekEnd(start)), "2026-10-25");
});
