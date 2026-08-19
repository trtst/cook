<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="account-navbar__title">账号设置</text>
    </template>

    <Login
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

        <view class="account-row" hover-class="is-pressed" hover-stay-time="100" @click="handleLogout">
          <view class="account-row__copy">
            <text class="account-row__title">退出登录</text>
          </view>
          <view class="account-row__meta">
            <text class="account-row__arrow cookfont icon-back" />
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { clearUserSessionState } from "@/utils/session-cleanup";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const phoneStatusText = computed(() => formatPhoneStatus(userStore.profile?.phone ?? null));

function handleBindPhone() {
  void uniPlatform.navigation.navigateTo("/pages_me/phone/index");
}

async function handleLogout() {
  loginModalStore.close();
  await clearUserSessionState();
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
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--theme-primary) 7%, transparent), transparent 34%),
    var(--color-page);
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
  overflow: hidden;
  border: 1rpx solid var(--color-divider);
  border-radius: 20rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
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
</style>
