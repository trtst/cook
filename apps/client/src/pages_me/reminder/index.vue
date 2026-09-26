<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="reminder-navbar__title">提醒设置</text>
    </template>

    <view class="reminder-page" :style="pageBodyStyle">
      <scroll-view class="reminder-scroll-view" scroll-y enhanced show-scrollbar="false">
        <view class="reminder-scroll">
          <template v-if="sessionStore.isLoggedIn">
            <view class="reminder-card">
              <view class="setting-group">
                <view class="setting-row setting-row--switch">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">餐次提醒</text>
                    <text class="setting-row__desc">目前仅保存偏好，微信通知尚未接入。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.meal.enabled }" @click="toggleMeal">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>
              </view>

              <view class="setting-group">
                <view class="setting-row setting-row--switch">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">推荐提醒</text>
                    <text class="setting-row__desc">目前仅保存偏好，微信通知尚未接入。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.recommend.enabled }" @click="toggleRecommend">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>
              </view>

            </view>
          </template>
        </view>
      </scroll-view>

      <view v-if="sessionStore.isLoggedIn" class="reminder-footer">
        <button class="reminder-footer__button" :loading="saving" @click="saveSettings">保存设置</button>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { userApi, type NotificationSettingsResponse } from "@/apis/user";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { mealSlotDefaultTime } from "@/utils/meal-slot";

type ReminderSettings = NotificationSettingsResponse;

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const saving = ref(false);
let loadSettingsPromise: Promise<void> | null = null;
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

const settings = reactive<ReminderSettings>(buildDefaultSettings());

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadSettings().catch(() => null);
});

function buildDefaultMealTimes() {
  return {
    breakfast: mealSlotDefaultTime("BREAKFAST"),
    lunch: mealSlotDefaultTime("LUNCH"),
    afternoonTea: mealSlotDefaultTime("AFTERNOON_TEA"),
    dinner: mealSlotDefaultTime("DINNER"),
    lateNight: mealSlotDefaultTime("LATE_NIGHT")
  };
}

function buildDefaultSettings(): ReminderSettings {
  return {
    meal: {
      enabled: true,
      times: buildDefaultMealTimes()
    },
    recommend: {
      enabled: false
    }
  };
}

function applySettings(next: ReminderSettings) {
  settings.meal.enabled = next.meal.enabled;
  settings.meal.times.breakfast = next.meal.times.breakfast;
  settings.meal.times.lunch = next.meal.times.lunch;
  settings.meal.times.afternoonTea = next.meal.times.afternoonTea;
  settings.meal.times.dinner = next.meal.times.dinner;
  settings.meal.times.lateNight = next.meal.times.lateNight;
  settings.recommend.enabled = next.recommend.enabled;
}

async function loadSettings() {
  if (loadSettingsPromise) {
    await loadSettingsPromise;
    return;
  }

  loadSettingsPromise = userApi
    .getNotificationSettings()
    .then(next => {
      applySettings(next);
    })
    .finally(() => {
      loadSettingsPromise = null;
    });

  await loadSettingsPromise;
}

function toggleMeal() {
  settings.meal.enabled = !settings.meal.enabled;
}

function toggleRecommend() {
  settings.recommend.enabled = !settings.recommend.enabled;
}

async function saveSettings() {
  if (!sessionStore.isLoggedIn || saving.value) return;

  saving.value = true;
  try {
    const saved = await userApi.updateNotificationSettings(JSON.parse(JSON.stringify(settings)));
    applySettings(saved);
    await uniPlatform.feedback.toast({
      title: "已保存",
      icon: "success"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({
      title: error instanceof Error ? error.message : "保存失败，请稍后重试",
      icon: "none"
    });
  } finally {
    saving.value = false;
  }
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  await loadSettings().catch(() => null);
}

function automatorReadState() {
  return JSON.parse(JSON.stringify(settings));
}

defineExpose({
  automatorApplySession,
  automatorReadState,
  automatorSaveSettings: saveSettings
});
</script>

<style scoped lang="scss">
.reminder-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.reminder-page {
  box-sizing: border-box;
  height: 100%;
  background: var(--page-primary-soft-bg);
}

.reminder-scroll-view {
  height: 100%;
}

.reminder-scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding-top: var(--space-sm);
  padding-right: var(--space-page);
  padding-bottom: calc(168rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.reminder-card {
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.setting-group + .setting-group {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--color-divider);
}

.setting-group .setting-row + .setting-row {
  border-top: 1rpx solid var(--color-divider);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
}

.setting-row--switch {
  min-height: 112rpx;
}

.setting-toggle {
  position: relative;
  flex: 0 0 auto;
  width: 80rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  box-shadow: inset 0 0 0 1rpx var(--color-border-light);
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.setting-toggle--on {
  background: var(--color-support-action);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
}

.setting-toggle__thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease;
}

.setting-toggle--on .setting-toggle__thumb {
  transform: translateX(32rpx);
}

.setting-row__copy {
  flex: 1;
  min-width: 0;
}

.setting-row__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.setting-row__desc {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.reminder-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 24rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
}

.reminder-footer__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 84rpx;
  margin: 0;
  padding: 0 28rpx;
  border: 0;
  border-radius: 999rpx;
  color: var(--button-primary-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.reminder-footer__button::after {
  border: none;
}
</style>
