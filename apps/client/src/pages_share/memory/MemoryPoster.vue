<template>
  <view class="poster" :style="posterStyle">
    <view class="poster__content">
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

    <view v-if="view.showParticipants || editable" class="poster__section">
      <view class="poster__section-head">
        <text class="poster__section-title">一起吃饭的人</text>
        <view v-if="editable" class="poster__member-toggle" :class="{ 'poster__member-toggle--checked': showParticipants }" role="checkbox" :aria-checked="showParticipants" @click="emit('toggleParticipants')">
          <text>展示成员</text><text class="cookfont" :class="showParticipants ? 'icon-select-on' : 'icon-select-off'" />
        </view>
      </view>
      <view class="poster__people-wrap">
        <view v-if="view.showParticipants" class="poster__people" :class="{ 'poster__people--masked': editable && !showParticipants }">
          <view v-for="participant in view.participants" :key="`${participant.role}-${participant.displayName}`" class="poster__person">
            <text class="poster__person-name">{{ participant.displayName }}</text>
            <text class="poster__person-role">{{ roleLabel(participant.role) }}</text>
          </view>
        </view>
        <view v-if="editable && !showParticipants" class="poster__people-mask" aria-hidden="true"><text>不会出现在分享图片中</text></view>
      </view>
    </view>

    <view v-if="view.showCaption || editable" class="poster__quote">
      <text class="poster__quote-label">这次回忆</text>
      <view class="poster__quote-content">
        <view class="poster__quote-line" />
        <textarea v-if="editable" v-model="editorCaption" class="poster__quote-input" auto-height maxlength="120" placeholder="把这一餐最想记住的事写下来（可选）" placeholder-class="poster__quote-placeholder" />
        <text v-else class="poster__quote-text">“{{ view.caption }}”</text>
      </view>
    </view>

      <view class="poster__footer" :class="{ 'poster__footer--separated': view.showParticipants || view.showCaption || editable, 'poster__footer--unseparated': !view.showParticipants && !view.showCaption && !editable }">
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
    <view class="poster__footer-tint" aria-hidden="true" />
  </view>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";
import { MEMORY_POSTER_TEMPLATE, type MemoryPosterView } from "./memory-poster";

const props = withDefaults(defineProps<{
  view: MemoryPosterView;
  miniCodeUrl?: string | null;
  editable?: boolean;
  showParticipants?: boolean;
  captionValue?: string;
}>(), {
  miniCodeUrl: null,
  editable: false,
  showParticipants: true,
  captionValue: ""
});

const emit = defineEmits<{
  toggleParticipants: [];
  "update:caption": [value: string];
}>();

const { view, miniCodeUrl } = toRefs(props);
const editable = computed(() => props.editable);
const showParticipants = computed(() => props.showParticipants);
const editorCaption = computed({
  get: () => props.captionValue,
  set: value => emit("update:caption", value)
});

const posterStyle = computed(() => ({
  "--poster-bg": "#ffffff",
  "--poster-surface": "#ffffff",
  "--poster-text": "#1d1d1d",
  "--poster-accent": "var(--color-primary)",
  "--poster-muted": "#747474",
  "--poster-line": "#e8e8e8",
  "--poster-orb": "var(--color-primary-soft)",
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
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 38rpx 42rpx 34rpx;
  overflow: hidden;
  color: var(--poster-text);
  background: var(--poster-bg);
  font-family: var(--poster-font-body);
  isolation: isolate;
}

.poster::before {
  position: absolute;
  top: -100rpx;
  right: -120rpx;
  z-index: 0;
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  background: var(--page-hero-halo-bg);
  content: "";
  opacity: .72;
  pointer-events: none;
}

.poster__content {
  position: relative;
  z-index: 1;
}

.poster__footer-tint {
  position: absolute;
  bottom: -10rpx;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 320rpx;
  background: var(--poster-orb);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
  pointer-events: none;
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

.poster__member-toggle {
  display: inline-flex;
  min-height: 48rpx;
  align-items: center;
  gap: 10rpx;
  color: var(--poster-muted);
  font-size: 20rpx;
}

.poster__member-toggle--checked {
  color: var(--poster-accent);
}

.poster__member-toggle .cookfont {
  font-size: 28rpx;
  line-height: 1;
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

.poster__people-wrap {
  position: relative;
}

.poster__people--masked {
  filter: blur(8rpx);
}

.poster__people-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--poster-muted);
  font-size: 20rpx;
  background: rgba(255, 255, 255, .62);
  pointer-events: none;
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

.poster__quote-input {
  width: 100%;
  min-height: 44rpx;
  padding: 0;
  color: var(--poster-text);
  background: transparent;
  font-family: var(--poster-font-title);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.75;
}

:deep(.poster__quote-placeholder) {
  line-height: 1.75;
  color: var(--poster-muted);
}

.poster__footer {
  margin-top: 40rpx;
  padding-top: 30rpx;
}

.poster__footer--separated {
  border-top: 1rpx solid var(--poster-line);
}

.poster__footer--unseparated {
  padding-top: 0;
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
