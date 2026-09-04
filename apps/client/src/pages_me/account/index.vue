<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="account-navbar__title">账号设置</text>
    </template>

    <LoginEmptyState
      v-if="!sessionStore.isLoggedIn"
      class="account-login-shell"
      :style="pageBodyStyle"
      title="登录后管理当前账号"
      description="账号设置里的手机号与退出登录只作用于当前登录账号。"
    />

    <view v-else class="account-page" :style="pageBodyStyle">
      <view class="account-panel">
        <view class="account-row" hover-class="is-pressed" hover-stay-time="100" @click="handleBindPhone">
          <view class="account-row__copy">
            <text class="account-row__title">绑定手机号</text>
          </view>
          <view class="account-row__meta">
            <text class="account-row__status">{{ phoneStatusText }}</text>
            <text class="account-row__arrow cookfont icon-back" />
          </view>
        </view>
        <view class="account-row" hover-class="is-pressed" hover-stay-time="100" @click="handlePassword">
          <view class="account-row__copy">
            <text class="account-row__title">{{ passwordEntryTitle }}</text>
          </view>
          <view class="account-row__meta">
            <text class="account-row__status">{{ passwordStatusText }}</text>
            <text class="account-row__arrow cookfont icon-back" />
          </view>
        </view>
      </view>

      <view class="account-panel account-panel--danger">
        <view class="account-row account-row--danger" hover-class="is-pressed" hover-stay-time="100" @click="handleLogout">
          <view class="account-row__copy">
            <text class="account-row__title">退出登录</text>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { authApi } from "@/apis/auth";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import type { MeResponse } from "@/apis/user";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { clearUserSessionState } from "@/utils/session-cleanup";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const phoneStatusText = computed(() => formatPhoneStatus(sessionStore.user?.phone ?? null));
const passwordEntryTitle = computed(() => (userStore.profile?.hasPassword ? "修改密码" : "设置密码"));
const passwordStatusText = computed(() => (userStore.profile?.hasPassword ? "已设置" : "未设置"));

function handleBindPhone() {
  void uniPlatform.navigation.navigateTo("/pages_me/phone/index");
}

function handlePassword() {
  void uniPlatform.navigation.navigateTo("/pages_me/password/index");
}

async function handleLogout() {
  const confirmed = await uniPlatform.feedback.confirm({
    title: "确认退出登录？",
    content: "退出后会清空当前账号的本地登录状态，需要重新登录后才能继续查看文章、计划和个人资料。",
    confirmText: "退出登录",
    tone: "danger"
  });
  if (!confirmed) return;

	loginModalStore.close();
	await authApi.logout({
		refreshToken: sessionStore.refreshToken,
		deviceId: uniPlatform.auth.getDeviceId()
	}).catch(() => undefined);
	await clearUserSessionState({ explicitLogout: true });
  await uniPlatform.feedback.toast({
    title: "已退出登录",
    icon: "success"
  }).catch(() => undefined);
  await uniPlatform.navigation.navigateBack().catch(() => uniPlatform.navigation.switchTab("/pages/me/index"));
}

function formatPhoneStatus(phone: string | null) {
  const value = (phone || "").trim();
  if (!value) return "未绑定";
  return value;
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }, profile?: MeResponse | null) {
  await sessionStore.setSession(snapshot);
  if (profile) {
    userStore.setProfile(profile, sessionStore.uid);
    return;
  }
  userStore.clearProfile();
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  userStore.clearProfile();
}

defineExpose({
  automatorApplySession,
  automatorClearSession
});
</script>

<style scoped lang="scss">
.account-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  overflow: hidden;
  background: var(--page-primary-soft-bg);
}

.account-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.account-login-shell {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.account-panel {
  margin-top: var(--space-lg);
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.account-panel:first-child {
  margin-top: 0;
}

.account-row {
  display: flex;
  align-items: center;
  min-height: 94rpx;
  padding: 0 24rpx;
}

.account-row + .account-row {
  border-top: 1rpx solid var(--color-divider);
}

.account-row__copy {
  flex: 1;
  min-width: 0;
}

.account-row__title {
  display: block;
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
}

.account-row__meta {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-left: var(--space-lg);
}

.account-row__status {
  color: var(--color-text-tertiary);
  font-size: 26rpx;
}

.account-row__arrow {
  margin-left: 10rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1;
  transform: rotate(180deg);
}

.account-panel--danger {
  border-color: var(--color-state-danger-border);
}

.account-row--danger .account-row__title,
.account-row--danger .account-row__arrow {
  color: var(--color-state-danger-text);
}

.account-row--danger {
  justify-content: center;
}

.account-row--danger .account-row__copy {
  flex: 0 0 auto;
  text-align: center;
}
</style>
