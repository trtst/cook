<template>
  <view class="poster" :style="posterStyle">
    <view class="poster__brand-row">
      <image class="poster__logo" :src="MEMORY_POSTER_TEMPLATE.brandLogoUrl" mode="widthFix" />
      <text class="poster__eyebrow">活动回忆卡</text>
    </view>
    <view class="poster__rule" />

    <text class="poster__title">{{ view.title }}</text>
    <text class="poster__meta">{{ view.metaText }}</text>

    <template v-if="view.showCover && view.coverImageUrl">
      <image class="poster__cover" :src="view.coverImageUrl" mode="aspectFill" />
      <text class="poster__photo-caption">从厨房的热气，到餐桌上的相聚。</text>
    </template>

    <view class="poster__rule" />
    <view class="poster__section-head">
      <text class="poster__section-title">这顿吃了什么</text>
      <text class="poster__count">{{ view.menuItems.length }}道菜</text>
    </view>
    <view class="poster__menu">
      <view v-for="(item, index) in view.menuItems" :key="`${item.title}-${index}`" class="poster__menu-item">
        <text class="poster__number">{{ String(index + 1).padStart(2, "0") }}</text>
        <text class="poster__menu-name">{{ item.title }}</text>
      </view>
    </view>

    <view v-if="view.showParticipants" class="poster__section">
      <text class="poster__section-title">一起吃饭的人</text>
      <view class="poster__people">
        <view v-for="participant in view.participants" :key="`${participant.role}-${participant.displayName}`" class="poster__person">
          <text class="poster__person-name">{{ participant.displayName }}</text>
          <text class="poster__person-role">{{ roleLabel(participant.role) }}</text>
        </view>
      </view>
    </view>

    <view v-if="view.showCaption" class="poster__quote">
      <text class="poster__quote-label">这次回忆</text>
      <view class="poster__quote-content">
        <view class="poster__quote-line" />
        <text class="poster__quote-text">“{{ view.caption }}”</text>
      </view>
    </view>

    <view class="poster__footer">
      <view class="poster__footer-copy">
        <text class="poster__footer-title">家的味道，都在这里了</text>
        <text class="poster__footer-hint">长按识别小程序码 · 看看这次相聚</text>
      </view>
      <view class="poster__code-wrap">
        <image v-if="miniCodeUrl" class="poster__code" :src="miniCodeUrl" mode="aspectFit" />
        <view v-else class="poster__code-placeholder">
          <text class="poster__code-mark">炊</text>
        </view>
        <text class="poster__code-label">{{ miniCodeUrl ? "长按识别" : "分享时生成" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MEMORY_POSTER_TEMPLATE, type MemoryPosterView } from "./memory-poster";

defineProps<{
  view: MemoryPosterView;
  miniCodeUrl?: string | null;
}>();

const posterStyle = computed(() => ({
  "--poster-bg": MEMORY_POSTER_TEMPLATE.colors.background,
  "--poster-surface": MEMORY_POSTER_TEMPLATE.colors.surface,
  "--poster-text": MEMORY_POSTER_TEMPLATE.colors.text,
  "--poster-accent": MEMORY_POSTER_TEMPLATE.colors.accent,
  "--poster-muted": MEMORY_POSTER_TEMPLATE.colors.muted,
  "--poster-line": MEMORY_POSTER_TEMPLATE.colors.line,
  "--poster-font-title": MEMORY_POSTER_TEMPLATE.fonts.title,
  "--poster-font-body": MEMORY_POSTER_TEMPLATE.fonts.body
}));

function roleLabel(role: MemoryPosterView["participants"][number]["role"]) {
  if (role === "ORGANIZER") return "主理人";
  if (role === "PARTICIPANT") return "参与人";
  return "来客";
}
</script>

<style scoped lang="scss">
.poster {
  box-sizing: border-box;
  width: 100%;
  padding: 38rpx 42rpx 34rpx;
  overflow: hidden;
  color: var(--poster-text);
  background: var(--poster-bg);
  font-family: var(--poster-font-body);
}

.poster__brand-row,
.poster__section-head,
.poster__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poster__logo {
  width: 142rpx;
}

.poster__eyebrow,
.poster__section-title {
  color: var(--poster-accent);
}

.poster__eyebrow,
.poster__meta,
.poster__photo-caption,
.poster__count,
.poster__number,
.poster__person-role,
.poster__footer-hint,
.poster__code-label {
  font-size: 20rpx;
}

.poster__rule {
  height: 1rpx;
  margin: 26rpx 0 30rpx;
  background: var(--poster-line);
}

.poster__title,
.poster__meta,
.poster__photo-caption,
.poster__section-title,
.poster__count,
.poster__number,
.poster__menu-name,
.poster__person-name,
.poster__person-role,
.poster__quote-text,
.poster__footer-title,
.poster__footer-hint,
.poster__code-mark,
.poster__code-label {
  display: block;
}

.poster__title {
  font-family: var(--poster-font-title);
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.2;
}

.poster__meta {
  margin-top: 14rpx;
  color: var(--poster-muted);
}

.poster__cover {
  width: 100%;
  height: 330rpx;
  margin-top: 28rpx;
}

.poster__photo-caption {
  margin-top: 14rpx;
  color: var(--poster-muted);
}

.poster__section-head {
  margin-bottom: 18rpx;
}

.poster__section-title {
  font-size: 23rpx;
}

.poster__count,
.poster__number,
.poster__person-role,
.poster__footer-hint,
.poster__code-label {
  color: var(--poster-muted);
}

.poster__menu {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 36rpx;
}

.poster__menu-item {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--poster-line);
}

.poster__number {
  width: 38rpx;
  flex: none;
}

.poster__menu-name {
  min-width: 0;
  overflow: hidden;
  font-size: 25rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster__section {
  margin-top: 34rpx;
}

.poster__people {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22rpx 16rpx;
  margin-top: 24rpx;
}

.poster__person-name {
  overflow: hidden;
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster__person-role {
  margin-top: 8rpx;
}

.poster__quote {
  margin-top: 36rpx;
}

.poster__quote-label {
  display: block;
  color: var(--poster-accent);
  font-size: 23rpx;
}

.poster__quote-content {
  display: flex;
  align-items: stretch;
  margin-top: 14rpx;
}

.poster__quote-line {
  width: 4rpx;
  flex: none;
  margin-right: 24rpx;
  background: var(--poster-accent);
}

.poster__quote-text {
  font-family: var(--poster-font-title);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.75;
}

.poster__footer {
  margin-top: 40rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid var(--poster-line);
}

.poster__footer-copy {
  min-width: 0;
  padding-right: 20rpx;
}

.poster__footer-title {
  font-size: 25rpx;
}

.poster__footer-hint {
  margin-top: 13rpx;
}

.poster__code-wrap {
  display: flex;
  width: 128rpx;
  flex: none;
  flex-direction: column;
  align-items: center;
}

.poster__code,
.poster__code-placeholder {
  width: 112rpx;
  height: 112rpx;
}

.poster__code-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx dotted var(--poster-muted);
  border-radius: 50%;
  background: var(--poster-surface);
}

.poster__code-mark {
  color: var(--poster-accent);
  font-size: 32rpx;
  font-weight: 700;
}

.poster__code-label {
  margin-top: 8rpx;
  font-size: 16rpx;
  white-space: nowrap;
}
</style>
