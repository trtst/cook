import assert from "node:assert/strict";
import test from "node:test";
import { buildMemoryPosterView } from "./memory-poster";
import { drawMemoryPoster } from "./memory-poster-renderer";

function posterView(coverImageUrl: string | null) {
  return buildMemoryPosterView({
    title: "周末家宴",
    planDate: "2026-09-10",
    mealSlot: "DINNER",
    coverImageUrl,
    menuItems: [{ title: "番茄炒蛋", coverUrl: null }],
    participants: [{ displayName: "小禾", avatarUrl: null, role: "ORGANIZER" }],
    caption: "今晚大家都在。",
    sharedAt: null,
    snapshotVersion: null
  });
}

test("poster renderer draws configured logo, activity content, cover and mini code into the exported image", () => {
  const labels: string[] = [];
  const textDraws: Array<{ value: string; y: number; color: string }> = [];
  const images: unknown[] = [];
  const arcs: Array<[number, number, number]> = [];
  let fillStyle = "";
  const context = {
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textBaseline: "top",
    get fillStyle() { return fillStyle; },
    set fillStyle(value: string) { fillStyle = value; },
    save() {},
    restore() {},
    beginPath() {},
    arc(x: number, y: number, radius: number) { arcs.push([x, y, radius]); },
    clip() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect() {},
    drawImage(image: unknown) { images.push(image); },
    createLinearGradient() { return { addColorStop() {} }; },
    fillText(value: string, _x: number, y: number) { labels.push(value); textDraws.push({ value, y, color: fillStyle }); },
    measureText(value: string) { return { width: value.length * 30 }; }
  };

  drawMemoryPoster(context as never, posterView("https://example.com/cover.jpg"), {
    logo: "logo-image",
    cover: "cover-image",
    miniCode: "mini-code-image"
  });

  assert.ok(labels.includes("周末家宴"));
  assert.ok(labels.includes("20"));
  assert.ok(labels.includes("26"));
  assert.ok(labels.includes("09.10"));
  assert.ok(labels.includes("四"));
  assert.ok(arcs.some(([x, y, radius]) => x === 990 && y === 64 && radius === 22));
  assert.deepEqual(textDraws.filter(item => item.value === "20" || item.value === "26").map(item => item.color), ["#1d1d1d", "#1d1d1d"]);
  assert.equal(textDraws.find(item => item.value === "四")?.y, 55);
  assert.ok(labels.includes("番茄炒蛋"));
  assert.ok(labels.includes("这次回忆"));
  assert.ok(labels.includes("家的味道，都在这里了"));
  assert.deepEqual(images, ["logo-image", "cover-image", "mini-code-image"]);
});

test("poster renderer omits the cover image when the activity has no cover", () => {
  const images: unknown[] = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textBaseline: "top",
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    clip() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect() {},
    drawImage(image: unknown) { images.push(image); },
    createLinearGradient() { return { addColorStop() {} }; },
    fillText() {},
    measureText(value: string) { return { width: value.length * 30 }; }
  };

  drawMemoryPoster(context as never, posterView(null), {
    logo: "logo-image",
    cover: null,
    miniCode: "mini-code-image"
  });

  assert.deepEqual(images, ["logo-image", "mini-code-image"]);
});
