import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildMemoryPosterView, MEMORY_POSTER_TEMPLATE } from "./memory-poster";

const baseCard = {
  title: "今晚，来家里吃饭",
  planDate: "2026-09-10",
  mealSlot: "DINNER" as const,
  coverImageUrl: "https://example.com/event-cover.jpg",
  menuItems: [
    { title: "番茄炒蛋", coverUrl: null },
    { title: "玉米排骨汤", coverUrl: null }
  ],
  participants: [
    { displayName: "小禾", avatarUrl: null, role: "ORGANIZER" as const },
    { displayName: "阿远", avatarUrl: null, role: "PARTICIPANT" as const }
  ],
  caption: "今天这一顿，终于把大家都约齐了。",
  sharedAt: null,
  snapshotVersion: null
};

test("poster view uses the activity cover and includes optional memory sections", () => {
  const view = buildMemoryPosterView(baseCard);

  assert.equal(view.coverImageUrl, "https://example.com/event-cover.jpg");
  assert.equal(view.showParticipants, true);
  assert.equal(view.showCaption, true);
  assert.equal(view.height, 1730);
  assert.deepEqual(view.menuRows, [["番茄炒蛋", "玉米排骨汤"]]);
});

test("poster view turns the plan date into the split year, date and weekday header", () => {
  const view = buildMemoryPosterView({
    ...baseCard,
    planDate: "2026-09-12"
  });

  assert.deepEqual(view.date, {
    yearTop: "20",
    yearBottom: "26",
    text: "09.12",
    weekday: "六"
  });
});

test("poster view collapses cover, participant and caption space when content is absent", () => {
  const view = buildMemoryPosterView({
    ...baseCard,
    coverImageUrl: null,
    participants: [],
    caption: null
  });

  assert.equal(view.showCover, false);
  assert.equal(view.showParticipants, false);
  assert.equal(view.showCaption, false);
  assert.equal(view.footerY, 565);
  assert.equal(view.height, 815);
});

test("the first poster template keeps future visual choices in one configuration", () => {
  assert.equal(MEMORY_POSTER_TEMPLATE.id, "memory-white-v2");
  assert.equal(MEMORY_POSTER_TEMPLATE.brandLogoUrl, "https://static.trtst.com/O/logo.png");
  assert.deepEqual(MEMORY_POSTER_TEMPLATE.colors, {
    background: "#ffffff",
    surface: "#ffffff",
    text: "#1d1d1d",
    muted: "#747474",
    accent: "#d67a54",
    line: "#e8e8e8",
    orb: "rgba(214, 122, 84, 0.14)"
  });
  assert.equal(MEMORY_POSTER_TEMPLATE.fonts.title, "serif");
});

test("the DOM preview reads both font families from the poster template", () => {
  const source = readFileSync(resolve(__dirname, "MemoryPoster.vue"), "utf8");

  assert.match(source, /--poster-font-title.*MEMORY_POSTER_TEMPLATE\.fonts\.title/);
  assert.match(source, /--poster-font-body.*MEMORY_POSTER_TEMPLATE\.fonts\.body/);
  assert.match(source, /font-family:\s*var\(--poster-font-title\)/);
  assert.match(source, /font-family:\s*var\(--poster-font-body\)/);
});

test("poster height grows for additional menu, participant and caption rows", () => {
  const view = buildMemoryPosterView({
    ...baseCard,
    menuItems: [...baseCard.menuItems, { title: "清炒时蔬", coverUrl: null }],
    participants: [
      ...baseCard.participants,
      { displayName: "圆圆", avatarUrl: null, role: "GUEST" },
      { displayName: "小满", avatarUrl: null, role: "GUEST" },
      { displayName: "阿青", avatarUrl: null, role: "GUEST" }
    ],
    caption: "这一句话很长，需要在海报里自然换行，而且不能覆盖下面的小程序码区域。"
  });

  assert.equal(view.menuRows.length, 2);
  assert.equal(view.participantRows.length, 2);
  assert.ok(view.captionLines.length >= 2);
  assert.equal(view.height, view.footerY + 250);
  assert.ok(view.height > 1900);
});
