<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="theme-navbar__title">主题皮肤</text>
    </template>

    <view class="theme-shell" :style="pageBodyStyle">
      <view class="theme-page">
        <view class="theme-page__main">
          <view class="theme-hero">
            <view class="theme-hero__blob theme-hero__blob--left" />
            <view class="theme-hero__blob theme-hero__blob--right" />
            <text class="theme-card__eyebrow">当前主题</text>
            <text class="theme-card__title">{{ currentThemeText }}</text>
            <text class="theme-card__description">个性皮肤</text>
          </view>

          <view class="theme-card">
            <text class="theme-card__section-title">主题</text>
            <view class="option-row">
              <view
                v-for="option in themeOptions"
                :key="option.value"
                class="option-chip"
                :class="{ 'option-chip--active': option.value === currentThemeFamily }"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleThemeFamilyChange(option.value)"
              >
                <text class="option-chip__text">{{ option.label }}</text>
              </view>
            </view>
          </view>

          <view v-if="showSchemeCard" class="theme-card">
            <text class="theme-card__section-title">色系</text>
            <view class="option-row">
              <view
                v-for="option in schemeOptions"
                :key="option.value"
                class="option-chip"
                :class="{ 'option-chip--active': option.value === currentSchemeValue }"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleThemeSchemeChange(option.value)"
              >
                <text class="option-chip__text">{{ option.label }}</text>
              </view>
            </view>
          </view>

          <view v-if="showModeCard" class="theme-card">
            <text class="theme-card__section-title">模式</text>
            <view class="option-row">
              <view
                v-for="option in modeOptions"
                :key="option.value"
                class="option-chip"
                :class="{ 'option-chip--active': option.value === currentModeValue }"
                hover-class="is-pressed"
                hover-stay-time="100"
                @click="handleThemeModeChange(option.value)"
              >
                <text class="option-chip__text">{{ option.label }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="theme-footer">
          <button class="theme-footer__button" @click="confirmThemeSelection">使用当前主题</button>
        </view>

        <view class="theme-page__preview">
          <view class="theme-preview-note">
            <text class="theme-preview-note__title">TabBar 预览</text>
            <text class="theme-preview-note__text">仅预览当前底部导航，不可点击。</text>
          </view>
          <TabBar class="theme-page__preview-tabbar" current="me" :interactive="false" :fixed="false" />
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onUnload } from "@dcloudio/uni-app";
import { computed } from "vue";
import Layout from "@/components/Layout/Layout.vue";
import TabBar from "@/components/TabBar/TabBar.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import {
  DEFAULT_THEME_PALETTE,
  THEME_MODE_LABELS,
  THEME_PALETTE_LABELS,
  THEME_SKIN_LABELS,
  supportsDarkForSkin,
  type ThemePalette,
  type ThemeSkin
} from "@/themes";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();
const {
  themeVars,
  themeClasses,
  effectiveSkin,
  effectivePalette,
  themeMode,
  setThemeMode,
  setThemeSkin,
  setThemePalette
} = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
let committedTheme = settingsStore.readPersistedThemeSettings();
let confirmedThisVisit = false;

const THEME_MODE_OPTIONS = [
  { label: THEME_MODE_LABELS.system, value: "system" },
  { label: THEME_MODE_LABELS.light, value: "light" },
  { label: THEME_MODE_LABELS.dark, value: "dark" }
] as const;
const DEFAULT_THEME_SCHEME_OPTIONS = [
  { label: THEME_PALETTE_LABELS.default, value: "default" },
  { label: THEME_PALETTE_LABELS.warm, value: "warm" },
  { label: THEME_PALETTE_LABELS.olive, value: "olive" },
  { label: THEME_PALETTE_LABELS.cool, value: "cool" }
] as const;
const THEME_OPTIONS = [
  { label: THEME_SKIN_LABELS["default"], value: "default" },
  { label: THEME_SKIN_LABELS["fresh-ingredient"], value: "fresh-ingredient" },
  { label: THEME_SKIN_LABELS["minimal-white"], value: "minimal-white" },
  { label: THEME_SKIN_LABELS["apple-glass"], value: "apple-glass" }
] as const;

type ThemeFamily = (typeof THEME_OPTIONS)[number]["value"];
type ThemeSchemeValue = (typeof DEFAULT_THEME_SCHEME_OPTIONS)[number]["value"];

const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

const currentThemeFamily = computed<ThemeFamily>(() => effectiveSkin.value);
const themeOptions = THEME_OPTIONS;
const currentThemeLabel = computed(() => THEME_SKIN_LABELS[effectiveSkin.value]);
const schemeOptions = computed(() => (effectiveSkin.value === "default" ? DEFAULT_THEME_SCHEME_OPTIONS : []));
const showSchemeCard = computed(() => schemeOptions.value.length > 0);
const showModeCard = computed(() => supportsDarkForSkin(effectiveSkin.value));
const currentSchemeValue = computed<ThemeSchemeValue>(() => {
  return effectiveSkin.value === "default" ? effectivePalette.value : DEFAULT_THEME_PALETTE;
});
const currentSchemeLabel = computed(() => {
  if (!showSchemeCard.value) return "";
  return THEME_PALETTE_LABELS[effectivePalette.value];
});
const modeOptions = computed(() => (showModeCard.value ? THEME_MODE_OPTIONS : []));
const currentModeValue = computed(() => (showModeCard.value ? themeMode.value : ""));
const currentModeLabel = computed(() => (showModeCard.value ? THEME_MODE_LABELS[themeMode.value] : ""));
const currentThemeText = computed(() =>
  [currentThemeLabel.value, currentSchemeLabel.value, currentModeLabel.value].filter(Boolean).join(" · ")
);

function buildAutomatorState() {
  return {
    themeMode: themeMode.value,
    effectiveSkin: effectiveSkin.value,
    effectivePalette: effectivePalette.value,
    currentThemeFamily: currentThemeFamily.value,
    currentThemeText: currentThemeText.value,
    showSchemeCard: showSchemeCard.value,
    showModeCard: showModeCard.value,
    themeOptions: themeOptions.map((option) => option.value),
    themeOptionLabels: themeOptions.map((option) => option.label),
    schemeOptionLabels: schemeOptions.value.map((option) => option.label),
    themeModeOptions: modeOptions.value.map((option) => option.value)
  };
}

async function handleThemeModeChange(mode: (typeof THEME_MODE_OPTIONS)[number]["value"]) {
  if (!showModeCard.value) return;
  await setThemeMode(mode, false);
}

async function applyThemeFamily(themeFamily: ThemeFamily) {
  if (themeFamily === "default") {
    await setThemeSkin("default", false);
    await setThemePalette(DEFAULT_THEME_PALETTE, false);
    return;
  }

  await setThemeSkin(themeFamily, false);
  await setThemePalette(DEFAULT_THEME_PALETTE, false);
  if (!supportsDarkForSkin(themeFamily)) {
    await setThemeMode("light", false);
  }
}

async function handleThemeFamilyChange(themeFamily: ThemeFamily) {
  await applyThemeFamily(themeFamily);
}

async function handleThemeSchemeChange(value: ThemeSchemeValue) {
  if (effectiveSkin.value !== "default") return;

  await setThemeSkin("default", false);
  await setThemePalette(value as ThemePalette, false);
}

async function persistCurrentTheme() {
  await settingsStore.persistCurrentThemeSettings();
  committedTheme = settingsStore.readCurrentThemeSettings();
  confirmedThisVisit = true;
  await uniPlatform.feedback.toast({ title: "主题已保存", icon: "success" });
}

function openThemeLogin() {
  loginModalStore.open(null, () => {
    void persistCurrentTheme();
  });
}

async function confirmThemeSelection() {
  if (!sessionStore.isLoggedIn) {
    openThemeLogin();
    return;
  }

  await persistCurrentTheme();
}

async function restoreCommittedTheme() {
  await settingsStore.applyThemeSettings(committedTheme, false);
}

async function automatorReadState() {
  return {
    ...buildAutomatorState(),
    persistedThemeSkin: settingsStore.readPersistedThemeSettings().themeSkin,
    loginModalVisible: loginModalStore.visible
  };
}

async function automatorResetThemeSettings() {
  await settingsStore.clearSettings();
  committedTheme = settingsStore.readPersistedThemeSettings();
  confirmedThisVisit = false;
  return automatorReadState();
}

async function automatorSetThemeSkin(skin: ThemeSkin) {
  await setThemeSkin(skin, false);
  return automatorReadState();
}

async function automatorSetThemePalette(palette: ThemePalette) {
  await setThemePalette(palette, false);
  return automatorReadState();
}

async function automatorSelectThemeFamily(themeFamily: ThemeFamily) {
  await handleThemeFamilyChange(themeFamily);
  return automatorReadState();
}

async function automatorConfirmThemeSelection() {
  await confirmThemeSelection();
  return automatorReadState();
}

async function automatorApplyThemeLoginSuccess() {
  await persistCurrentTheme();
  loginModalStore.close();
  return automatorReadState();
}

async function automatorSimulateLeave() {
  confirmedThisVisit = false;
  await restoreCommittedTheme();
  return automatorReadState();
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  loginModalStore.close();
}

defineExpose({
  automatorClearSession,
  automatorReadState,
  automatorResetThemeSettings,
  automatorSetThemeSkin,
  automatorSetThemePalette,
  automatorSelectThemeFamily,
  automatorConfirmThemeSelection,
  automatorApplyThemeLoginSuccess,
  automatorSimulateLeave
});

onUnload(() => {
  if (confirmedThisVisit) return;
  void restoreCommittedTheme();
});
</script>

<style scoped lang="scss">
.theme-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.theme-shell {
  height: 100%;
  background: var(--page-primary-soft-bg);
}

.theme-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding-right: var(--space-page);
  padding-left: var(--space-page);
}

.theme-page__main {
  flex: 1;
  min-height: 0;
  padding-bottom: var(--space-lg);
}

.theme-page__preview {
  position: relative;
  flex: 0 0 auto;
  margin-top: var(--space-lg);
}

.theme-footer {
  margin-top: var(--space-lg);
  padding-bottom: 0;
}

.theme-footer__button {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  color: var(--button-primary-text);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.theme-hero {
  position: relative;
  overflow: hidden;
  padding: 32rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
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
  background: var(--color-tag-primary-bg);
}

.theme-hero__blob--right {
  top: 26rpx;
  right: -40rpx;
  width: 260rpx;
  height: 260rpx;
  background: var(--color-tag-secondary-bg);
}

.theme-card {
  position: relative;
  margin-top: var(--space-lg);
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
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
  background: var(--color-support-notice);
  font-size: var(--font-size-xs);
  font-weight: 700;
  align-items: center;
}

.theme-card__title {
  display: block;
  position: relative;
  margin-top: 20rpx;
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.theme-card__description {
  display: block;
  position: relative;
  margin-top: 12rpx;
  font-size: var(--font-size-sm);
  line-height: 1.4;
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
  gap: 20rpx;
  margin-top: 20rpx;
}

.option-chip {
  display: flex;
  align-items: center;
  min-height: 60rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-xs);
  background: var(--material-control-bg);
  box-shadow: var(--material-control-shadow);
  -webkit-backdrop-filter: var(--material-control-filter);
  backdrop-filter: var(--material-control-filter);
}

.option-chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  // box-shadow: inset 0 0 0 1rpx var(--color-border-active);
}

.option-chip--active .option-chip__text {
  color: var(--color-tag-primary-text);
}

.option-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.theme-preview-note {
  padding: 0 2rpx 16rpx;
}

.theme-preview-note__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.theme-preview-note__text {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.6;
}

.theme-page__preview-tabbar {
  pointer-events: none;
}
</style>
