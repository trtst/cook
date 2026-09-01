<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
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
                    <text class="setting-row__desc">我们会在餐次前提醒你，方便你提前安排。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.meal.enabled }" @click="toggleMeal">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>
              </view>

              <view class="setting-group setting-group--paired">
                <view class="setting-row setting-row--switch">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">食材提醒</text>
                    <text class="setting-row__desc">临近到期时，按你设置的提前天数提醒处理。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.fridge.enabled }" @click="toggleFridge">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>

                <view class="setting-row setting-row--compact setting-row--days">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">提前天数</text>
                    <view class="day-chip-list">
                      <view
                        v-for="day in fridgeQuickDayOptions"
                        :key="day"
                        class="day-chip"
                        :class="{ 'day-chip--active': settings.fridge.days === day }"
                        @click="selectFridgeDays(day)"
                      >
                        <text class="day-chip__text">{{ day }}天</text>
                      </view>
                    </view>
                  </view>
                  <picker mode="selector" :range="fridgeDayOptions" :value="fridgeDayIndex" @change="updateFridgeDays">
                    <text class="setting-row__value">{{ settings.fridge.days }}天</text>
                  </picker>
                </view>
              </view>

              <view class="setting-group">
                <view class="setting-row setting-row--switch">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">推荐提醒</text>
                    <text class="setting-row__desc">每日推荐更新后提醒你查看。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.recommend.enabled }" @click="toggleRecommend">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>
              </view>

              <view class="setting-group">
                <view class="setting-row setting-row--switch">
                  <view class="setting-row__copy">
                    <text class="setting-row__title">消息免打扰</text>
                    <text class="setting-row__desc">关闭强提醒，仅保留站内红点提示。</text>
                  </view>
                  <view class="setting-toggle" :class="{ 'setting-toggle--on': settings.reminderDotOnly }" @click="toggleReminderDotOnly">
                    <view class="setting-toggle__thumb" />
                  </view>
                </view>
              </view>
            </view>
          </template>
        </view>
      </scroll-view>

      <view v-if="sessionStore.isLoggedIn" class="reminder-footer">
        <button class="reminder-footer__button" :loading="saving" :disabled="saving" @click="saveSettings">保存设置</button>
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

const fridgeDayOptions = ["1", "2", "3", "5", "7"];

type ReminderSettings = NotificationSettingsResponse;

type PickerValueEvent = Event & {
  detail?: {
    value?: string | number;
  };
};

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const saving = ref(false);
let loadSettingsPromise: Promise<void> | null = null;
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

const settings = reactive<ReminderSettings>(buildDefaultSettings());
const fridgeQuickDayOptions: ReminderSettings["fridge"]["days"][] = [3, 5, 7];
const fridgeDayIndex = computed(() => Math.max(fridgeDayOptions.indexOf(String(settings.fridge.days)), 0));

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
    reminderDotOnly: false,
    meal: {
      enabled: true,
      times: buildDefaultMealTimes()
    },
    fridge: {
      enabled: true,
      days: 3
    },
    recommend: {
      enabled: false
    }
  };
}

function applySettings(next: ReminderSettings) {
  settings.reminderDotOnly = next.reminderDotOnly;
  settings.meal.enabled = next.meal.enabled;
  settings.meal.times.breakfast = next.meal.times.breakfast;
  settings.meal.times.lunch = next.meal.times.lunch;
  settings.meal.times.afternoonTea = next.meal.times.afternoonTea;
  settings.meal.times.dinner = next.meal.times.dinner;
  settings.meal.times.lateNight = next.meal.times.lateNight;
  settings.fridge.enabled = next.fridge.enabled;
  settings.fridge.days = next.fridge.days;
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

function toggleFridge() {
  settings.fridge.enabled = !settings.fridge.enabled;
}

function toggleRecommend() {
  settings.recommend.enabled = !settings.recommend.enabled;
}

function toggleReminderDotOnly() {
  settings.reminderDotOnly = !settings.reminderDotOnly;
}

function updateFridgeDays(event: PickerValueEvent) {
  const nextIndex = Number(event.detail?.value);
  settings.fridge.days = Number(fridgeDayOptions[nextIndex] || "3") as ReminderSettings["fridge"]["days"];
}

function selectFridgeDays(days: ReminderSettings["fridge"]["days"]) {
  settings.fridge.days = days;
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

function automatorSelectFridgeDays(days: ReminderSettings["fridge"]["days"]) {
  selectFridgeDays(days);
  return automatorReadState();
}

function automatorToggleReminderDotOnly() {
  toggleReminderDotOnly();
  return automatorReadState();
}

defineExpose({
  automatorApplySession,
  automatorReadState,
  automatorSelectFridgeDays,
  automatorToggleReminderDotOnly,
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

.setting-group--paired .setting-row + .setting-row {
  border-top: 0;
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

.setting-row--compact {
  min-height: 96rpx;
}

.setting-row--days {
  align-items: flex-start;
  padding-top: 8rpx;
  padding-bottom: 4rpx;
}

.setting-toggle {
  position: relative;
  flex: 0 0 auto;
  width: 80rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-text-tertiary) 20%, var(--color-surface) 80%);
  box-shadow: inset 0 0 0 1rpx var(--color-border-light);
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.setting-toggle--on {
  background: var(--color-primary);
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary) 68%, transparent);
}

.setting-toggle__thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.14);
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

.setting-row__value {
  color: var(--color-primary);
  font-size: 40rpx;
  font-weight: var(--font-weight-semibold);
}

.day-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.day-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface-muted) 78%, transparent);
  box-shadow: inset 0 0 0 1rpx var(--color-divider);
}

.day-chip--active {
  background: var(--color-primary-soft-fill);
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.day-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.day-chip--active .day-chip__text {
  color: var(--color-primary);
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
