<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="theme-navbar__title">主题皮肤</text>
    </template>

    <scroll-view scroll-y class="theme-scroll" :show-scrollbar="false">
      <view class="theme-page" :style="pageBodyStyle">
        <view class="theme-hero">
          <view class="theme-hero__blob theme-hero__blob--left" />
          <view class="theme-hero__blob theme-hero__blob--right" />
          <text class="theme-card__eyebrow">当前主题</text>
          <text class="theme-card__title">{{ currentThemeText }}</text>
          <text class="theme-card__description">切换后会实时保存到本机。底部导航仅用于预览当前主题效果，不可点击。</text>
        </view>

        <view class="theme-card">
          <text class="theme-card__section-title">显示模式</text>
          <view class="option-row">
            <view
              v-for="option in themeModeOptions"
              :key="option.value"
              class="option-chip"
              :class="{ 'option-chip--active': option.value === themeMode }"
              hover-class="is-pressed"
              hover-stay-time="100"
              @click="handleThemeModeChange(option.value)"
            >
              <text class="option-chip__text">{{ option.label }}</text>
            </view>
          </view>
        </view>

        <view class="theme-card">
          <text class="theme-card__section-title">主题皮肤</text>
          <view class="option-row">
            <view
              v-for="option in skinOptions"
              :key="option.value"
              class="option-chip"
              :class="{ 'option-chip--active': option.value === effectiveSkin }"
              hover-class="is-pressed"
              hover-stay-time="100"
              @click="handleSkinChange(option.value)"
            >
              <text class="option-chip__text">{{ option.label }}</text>
            </view>
          </view>
        </view>

        <view v-if="canSwitchPalette" class="theme-card">
          <text class="theme-card__section-title">色系</text>
          <view class="option-row">
            <view
              v-for="palette in supportedPalettes"
              :key="palette"
              class="option-chip"
              :class="{ 'option-chip--active': palette === effectivePalette }"
              hover-class="is-pressed"
              hover-stay-time="100"
              @click="handlePaletteChange(palette)"
            >
              <text class="option-chip__text">{{ paletteLabels[palette] }}</text>
            </view>
          </view>
        </view>

        <view class="theme-preview-note">
          <text class="theme-preview-note__title">底部导航预览</text>
          <text class="theme-preview-note__text">这里固定展示当前主题下的 TabBar 样式，只用于预览，不参与跳转。</text>
        </view>
      </view>
    </scroll-view>

    <TabBar class="theme-page__preview-tabbar" current="me" :interactive="false" />
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Layout from "@/components/Layout/Layout.vue";
import TabBar from "@/components/TabBar/TabBar.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { THEME_SKIN_OPTIONS, type ThemePalette, type ThemeSkin } from "@/themes";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const {
  effectiveSkin,
  effectivePalette,
  themeMode,
  supportedPalettes,
  canSwitchPalette,
  setThemeMode,
  setThemeSkin,
  setThemePalette
} = useTheme();

const VISIBLE_SKINS: ThemeSkin[] = ["default", "handdrawn-food"];
const skinOptions = THEME_SKIN_OPTIONS.filter((option) => VISIBLE_SKINS.includes(option.value));
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const themeModeLabels = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色"
} as const;
const themeModeOptions = [
  { label: "跟随系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" }
] as const;
const paletteLabels: Record<ThemePalette, string> = {
  default: "默认",
  warm: "暖黄",
  olive: "橄榄",
  cool: "冷蓝"
};

const currentThemeText = computed(() => {
  const modeLabel = themeModeLabels[themeMode.value];
  const skinLabel = skinOptions.find((item) => item.value === effectiveSkin.value)?.label || "基础";
  if (!canSwitchPalette.value) return `${modeLabel} · ${skinLabel}`;
  return `${modeLabel} · ${skinLabel} · ${paletteLabels[effectivePalette.value]}`;
});

async function handleThemeModeChange(mode: (typeof themeModeOptions)[number]["value"]) {
  await setThemeMode(mode);
}

async function handleSkinChange(skin: ThemeSkin) {
  await setThemeSkin(skin);
}

async function handlePaletteChange(palette: ThemePalette) {
  await setThemePalette(palette);
}
</script>

<style scoped lang="scss">
.theme-scroll {
  height: 100vh;
}

.theme-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.theme-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-right: var(--space-page);
  padding-bottom: calc(220rpx + var(--space-xl) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--theme-primary) 9%, transparent), transparent 38%),
    var(--color-page);
}

.theme-hero {
  position: relative;
  overflow: hidden;
  padding: 34rpx 32rpx 40rpx;
  border-radius: 34rpx;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--color-surface) 88%, var(--theme-primary) 12%), var(--color-surface)),
    var(--color-surface);
  box-shadow: var(--shadow-card);
}

.theme-hero__blob {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.theme-hero__blob--left {
  top: -36rpx;
  left: -54rpx;
  width: 220rpx;
  height: 220rpx;
  background: color-mix(in srgb, var(--theme-primary) 16%, transparent);
}

.theme-hero__blob--right {
  top: 26rpx;
  right: -40rpx;
  width: 260rpx;
  height: 260rpx;
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

.theme-card {
  position: relative;
  margin-top: var(--space-lg);
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.theme-card__eyebrow,
.theme-card__description {
  color: var(--color-text-secondary);
}

.theme-card__eyebrow {
  display: inline-flex;
  position: relative;
  min-height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 12%, white);
  font-size: var(--font-size-xs);
  font-weight: 700;
  align-items: center;
}

.theme-card__title {
  display: block;
  position: relative;
  margin-top: 20rpx;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.theme-card__description {
  display: block;
  position: relative;
  margin-top: 12rpx;
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.theme-card__section-title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-top: var(--space-lg);
}

.option-chip {
  display: flex;
  align-items: center;
  min-height: 58rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.option-chip--active {
  border-color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
}

.option-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.theme-preview-note {
  padding: 10rpx 2rpx 0;
}

.theme-preview-note__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.theme-preview-note__text {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.theme-page__preview-tabbar {
  pointer-events: none;
}
</style>
