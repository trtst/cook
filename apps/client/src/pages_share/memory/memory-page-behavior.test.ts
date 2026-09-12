import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const posterSource = readFileSync(resolve(__dirname, "MemoryPoster.vue"), "utf8");
const rendererSource = readFileSync(resolve(__dirname, "memory-poster-renderer.ts"), "utf8");

test("participant visibility sits beside the poster people section title", () => {
  assert.match(posterSource, /icon-select-on/);
  assert.match(posterSource, /icon-select-off/);
  assert.match(source, /:editable="mode === 'event' && canManageEventShare"/);
  assert.match(source, /@toggle-participants="toggleParticipants"/);
  assert.match(source, /function toggleParticipants\(\) \{\s*showParticipants\.value = !showParticipants\.value;\s*invalidateShareSnapshot\(\);\s*\}/);
  assert.doesNotMatch(source, /memory-settings-entry/);
  assert.doesNotMatch(source, /SheetShell/);
  assert.doesNotMatch(source, /<switch/);
  assert.match(posterSource, /<view v-if="view\.showParticipants \|\| editable" class="poster__section">\s*<view class="poster__section-head">\s*<text class="poster__section-title">一起吃饭的人<\/text>\s*<view v-if="editable" class="poster__member-toggle"/);
});

test("opening an eligible event memory page prepares its first stable code, while a title edit only redraws the poster", () => {
  assert.match(source, /watch\(normalizedCaption, invalidateShareSnapshot\);/);
  assert.match(source, /watch\(title, invalidatePosterImage\);/);
  assert.match(source, /function invalidatePosterImage\(\) \{ posterFilePath\.value = ""; \}/);
  assert.match(source, /function invalidateShareSnapshot\(\) \{[\s\S]*shareSnapshot\.value = null;[\s\S]*posterFilePath\.value = "";/);
  assert.match(source, /eventDetail\.value = await mealApi\.getDiningEvent\(eventId\.value\);[\s\S]*title\.value = eventDetail\.value\.title;[\s\S]*if \(generateReady\.value && canManageEventShare\.value\) await createShareSnapshot\(\);/);
});

test("hidden participants stay masked in the editable poster but are omitted from the exported poster", () => {
  assert.match(source, /const exportPosterView = computed\(\(\) => cardData\.value \? buildMemoryPosterView\(\{ \.\.\.cardData\.value, title: posterTitle\.value \}\) : null\);/);
  assert.match(source, /const participants = mode\.value === "event" && canManageEventShare\.value && eventDetail\.value\s*\? buildDraftParticipants\(eventDetail\.value, true\)/);
  assert.match(source, /const view = exportPosterView\.value;/);
  assert.match(posterSource, /class="poster__people-wrap">\s*<view v-if="view\.showParticipants" class="poster__people" :class="\{ 'poster__people--masked': editable && !showParticipants \}"/);
  assert.match(posterSource, /v-if="editable && !showParticipants" class="poster__people-mask"/);
  assert.match(posterSource, /\.poster__people--masked \{\s*filter: blur\(8rpx\);/);
  assert.match(posterSource, /\.poster__people-mask \{[\s\S]*pointer-events: none;/);
});

test("the sharing page keeps a focused header with an optional poster preview", () => {
  assert.match(source, /<scroll-view class="memory-page" scroll-y>/);
  assert.match(source, />分享这次相聚<\/text>/);
  assert.match(source, />把餐桌的热闹，也送给没能到场的人。<\/text>/);
  assert.match(source, /class="preview-head__action"[^>]*@click="previewPoster">预览/);
  assert.match(source, /function previewPoster\(\)/);
});

test("the event owner can edit the local poster title while exported previews render it as text", () => {
  assert.match(source, /:title-value="title"/);
  assert.match(source, /@update:title="title = \$event"/);
  assert.match(posterSource, /<view v-if="editable" class="poster__title-row">\s*<input v-model="editorTitle" class="poster__title-input"/);
  assert.match(posterSource, /class="poster__title-input"[^>]*maxlength="10"/);
  assert.match(posterSource, /<text v-else class="poster__title">\{\{ view\.title \}\}<\/text>/);
  assert.match(posterSource, /:focus="titleFocused"/);
  assert.match(posterSource, /class="cookfont icon-edit poster__title-edit" @click="focusTitleInput"/);
  assert.match(posterSource, /function focusTitleInput\(\) \{[\s\S]*titleFocused\.value = false;[\s\S]*titleFocused\.value = true;/);
});

test("the split year uses the same color as the main date", () => {
  const yearStyle = posterSource.match(/\.poster__date-year\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(yearStyle, /color: var\(--poster-text\);/);
});

test("weekday is a dark circular badge in the poster preview", () => {
  assert.match(posterSource, /\.poster__date-weekday \{[\s\S]*display: flex;[\s\S]*width: 36rpx;[\s\S]*height: 36rpx;[\s\S]*border-radius: 50%;[\s\S]*color: #fff;[\s\S]*background: #111;/);
});

test("sharing tips stay short while the empty memory is edited in its poster position", () => {
  assert.match(source, /const shareTips = computed\(\(\) =>/);
  assert.match(source, /可在饭局详情上传封面图，让这次相聚更有画面。/);
  assert.match(source, /会展示参与成员，分享前再确认一下。/);
  assert.match(source, /v-if="shareTips\.length" class="share-tips"/);
  assert.match(source, /v-for="tip in shareTips"/);
  assert.match(source, /class="share-actions"/);
  assert.match(source, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /\.share-actions \{ position: fixed;/);
  assert.match(source, /\.memory-page \{ height: 100%; padding-bottom: calc\(120rpx \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(source, /min-height: 84rpx/);
  assert.match(posterSource, /v-if="view\.showCaption \|\| editable"/);
  assert.match(posterSource, /<textarea v-if="editable" v-model="editorCaption"[^>]*auto-height/);
  assert.match(posterSource, /把这一餐最想记住的事写下来（可选）/);
  assert.match(posterSource, /\.poster__quote-input \{[\s\S]*min-height: 44rpx;/);
  assert.doesNotMatch(source, /public-hint/);
});

test("the white poster takes its accent and footer tint from the current theme", () => {
  assert.match(posterSource, /"--poster-bg": "#ffffff"/);
  assert.match(posterSource, /"--poster-accent": "var\(--color-primary\)"/);
  assert.match(posterSource, /"--poster-orb": "var\(--color-primary-soft\)"/);
  assert.match(posterSource, /class="poster__footer-tint"/);
  assert.match(posterSource, /\.poster::before \{[\s\S]*background: var\(--page-hero-halo-bg\);/);
  assert.match(source, /readPosterColors\(\)/);
});

test("the poster avoids WXSS-incompatible negation selectors", () => {
  assert.doesNotMatch(posterSource, /:not\(/);
  assert.match(posterSource, /class="poster__content"/);
  assert.match(posterSource, /poster__footer--unseparated/);
});

test("caption is labelled in the poster preview above the footer", () => {
  assert.match(posterSource, /<text class="poster__quote-label">这次回忆<\/text>/);
});

test("the poster keeps just the menu divider when no optional section precedes its footer", () => {
  assert.match(posterSource, /'poster__footer--separated': view\.showParticipants \|\| view\.showCaption/);
  assert.match(rendererSource, /if \(view\.showParticipants \|\| view\.showCaption\) \{\s*rule\(ctx, footerY, colors\.line\);\s*\}/);
});

test("memory poster uses the configured HTTPS logo in both preview and canvas", () => {
  assert.match(source, /loadCanvasImage\(canvas, MEMORY_POSTER_TEMPLATE\.brandLogoUrl\)/);
  assert.match(posterSource, /<image class="poster__logo" :src="MEMORY_POSTER_TEMPLATE\.brandLogoUrl"/);
});

test("event mode poster actions are limited to the dining event organizer", () => {
  assert.match(source, /const canManageEventShare = computed\(\(\) => Boolean\(eventDetail\.value && eventDetail\.value\.organizerUid === sessionStore\.uid\)\)/);
  assert.match(source, /eventId\.value && generateReady\.value && canManageEventShare\.value/);
  assert.match(source, /if \(!eventId\.value \|\| !generateReady\.value \|\| !canManageEventShare\.value \|\| submitting\.value\) return null;/);
  assert.match(source, /:editable="mode === 'event' && canManageEventShare"/);
  assert.match(source, /v-if="canPreparePoster \|\| posterFilePath"/);
  assert.match(source, /function previewPoster\(\)/);
});
