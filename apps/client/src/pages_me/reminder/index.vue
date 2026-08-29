<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="reminder-navbar__title">提醒设置</text>
    </template>

    <view class="reminder-page" :style="pageBodyStyle">
      <view class="reminder-card reminder-card--hero">
        <text class="reminder-card__eyebrow">当前入口</text>
        <text class="reminder-card__title">提醒先统一收在通知中心</text>
        <text class="reminder-card__description">这一页先承接提醒设置入口，当前版本统一通过通知中心查看提醒记录，后续再补更细的提醒开关。</text>
      </view>

      <LoginEmptyState
        v-if="!sessionStore.isLoggedIn"
        class="reminder-login-shell"
        title="登录后查看提醒设置"
        description="上面的说明会继续保留；登录后再看当前账号对应的提醒与通知记录。"
      />

      <view v-else class="reminder-card">
        <view class="reminder-row" hover-class="is-pressed" hover-stay-time="100" @click="goRecommend">
          <view class="reminder-row__copy">
            <text class="reminder-row__title">通知中心</text>
            <text class="reminder-row__description">查看推荐审核、饭局邀请、计划进度和系统消息</text>
          </view>
          <text class="reminder-row__arrow">›</text>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

function goRecommend() {
  void uniPlatform.navigation.navigateTo("/pages_me/recommend/index");
}
</script>

<style scoped lang="scss">
.reminder-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.reminder-login-shell {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.reminder-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  overflow: hidden;
  background: var(--page-primary-soft-bg);
}

.reminder-card {
  margin-top: var(--space-lg);
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.reminder-card--hero {
  margin-top: 0;
}

.reminder-card__eyebrow,
.reminder-card__description,
.reminder-row__description {
  color: var(--color-text-secondary);
}

.reminder-card__eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: var(--color-support-notice);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.reminder-card__title {
  display: block;
  margin-top: 20rpx;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.reminder-card__description {
  display: block;
  margin-top: 12rpx;
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.reminder-row {
  display: flex;
  align-items: center;
  min-height: 112rpx;
}

.reminder-row__copy {
  flex: 1;
  min-width: 0;
}

.reminder-row__title,
.reminder-row__description {
  display: block;
}

.reminder-row__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.reminder-row__description {
  margin-top: 6rpx;
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.reminder-row__arrow {
  margin-left: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: 40rpx;
  line-height: 1;
}
</style>
