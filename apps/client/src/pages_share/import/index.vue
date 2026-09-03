<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="加入分享饭局">
    <LoginEmptyState
      v-if="!sessionStore.isLoggedIn"
      title="登录后加入饭局"
      description="分享预览可直接看；加入饭局需要登录并建立可信身份。"
      @success="handleLoginSuccess"
    />

    <template v-else>
      <view class="section">
        <text class="section__title">本次展示名称</text>
        <input v-model="guestName" class="input" placeholder="例如：周末来吃饭的我" />
        <button class="primary" :disabled="submitting || !shareToken || !guestName.trim()" @click="acceptInvite">确认加入</button>
      </view>

      <view v-if="errorText" class="notice">{{ errorText }}</view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import type { MeResponse } from "@/apis/user";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { shareApi } from "../apis/share";
import { resolveShareGuestName } from "../display-name";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));

const sessionStore = useSessionStore();
const userStore = useUserStore();
const shareToken = ref("");
const guestName = ref("");
const submitting = ref(false);
const errorText = ref("");

onLoad((query) => {
  const raw = Array.isArray(query?.token) ? query.token[0] : query?.token;
  shareToken.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  syncGuestName();
});

function syncGuestName() {
  if (!sessionStore.isLoggedIn) return;
  guestName.value = resolveShareGuestName(userStore.profile, sessionStore.uid);
}

async function handleLoginSuccess() {
  syncGuestName();
}

async function acceptInvite() {
  if (!shareToken.value || !guestName.value.trim() || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    await shareApi.acceptInvite(shareToken.value, createOperationId(), guestName.value.trim());
    await uniPlatform.feedback.toast({ title: "已加入饭局", icon: "success" });
    void uniPlatform.navigation.redirectTo("/pages_meal/event/index");
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入失败";
  } finally {
    submitting.value = false;
  }
}

async function automatorApplySession(
  snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number },
  profile?: MeResponse | null
) {
  await sessionStore.setSession(snapshot);
  if (profile) {
    userStore.setProfile(profile);
    return;
  }
  userStore.clearProfile();
}

async function automatorHandleLoginSuccess() {
  await handleLoginSuccess();
  return automatorReadState();
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  userStore.clearProfile();
}

function automatorReadState() {
  return {
    loggedIn: sessionStore.isLoggedIn,
    shareToken: shareToken.value,
    guestName: guestName.value,
    errorText: errorText.value,
    canSubmit: Boolean(guestName.value.trim() && shareToken.value && !submitting.value)
  };
}

defineExpose({
  automatorApplySession,
  automatorClearSession,
  automatorHandleLoginSuccess,
  automatorReadState
});
</script>

<style scoped lang="scss">
.section,
.notice {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.input {
  width: 100%;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-md);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
  box-sizing: border-box;
}

.primary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.notice {
  margin-top: var(--space-md);
  color: var(--color-state-danger-text);
}
</style>
