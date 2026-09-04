<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="password-navbar__title">{{ pageTitle }}</text>
    </template>

    <LoginEmptyState
      v-if="!sessionStore.isLoggedIn"
      class="password-login-shell"
      :style="pageBodyStyle"
      title="登录后设置密码"
      description="密码只用于当前手机号账号登录。"
    />

    <view v-else class="password-page" :style="pageBodyStyle">
      <view class="password-form-card">
        <view v-if="hasPassword" class="password-field">
          <text class="password-field__label">原密码</text>
          <input
            v-model="currentPassword"
            class="password-field__input"
            maxlength="128"
            password
            placeholder="请输入原密码"
            :disabled="loading"
          />
        </view>

        <view class="password-field" :class="{ 'password-field--bordered': hasPassword }">
          <text class="password-field__label">新密码</text>
          <input
            v-model="newPassword"
            class="password-field__input"
            maxlength="20"
            password
            placeholder="请输入新密码"
            :disabled="loading"
          />
        </view>

        <view class="password-field password-field--bordered">
          <text class="password-field__label">重复新密码</text>
          <input
            v-model="repeatPassword"
            class="password-field__input"
            maxlength="20"
            password
            placeholder="请再次输入新密码"
            :disabled="loading"
          />
        </view>
      </view>

      <view class="password-strength">
        <text class="password-strength__text">{{ errorText || " " }}</text>
        <view class="password-strength__bar">
          <view class="password-strength__value" :class="strengthClass" :style="{ width: strengthWidth }" />
        </view>
        <text class="password-footnote">密码需要 8-20 位字符，至少包含字母、数字、符号中的两种。</text>
      </view>

      <text v-if="helperText" class="password-helper">{{ helperText }}</text>

      <button class="password-submit" :disabled="loading" @click="handleSubmit">{{ loading ? "提交中" : "确定" }}</button>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { ApiClientError } from "@/apis/http";
import { userApi } from "@/apis/user";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const currentPassword = ref("");
const newPassword = ref("");
const repeatPassword = ref("");
const loading = ref(false);
const helperText = ref("");
const errorText = ref("");

const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const hasPassword = computed(() => Boolean(userStore.profile?.hasPassword));
const pageTitle = computed(() => (hasPassword.value ? "修改密码" : "设置密码"));
const strength = computed(() => getPasswordStrength(newPassword.value));
const strengthWidth = computed(() => {
  if (!newPassword.value) return "0%";
  return `${strength.value.score * 33}%`;
});
const strengthClass = computed(() => `password-strength__value--${strength.value.level}`);

onShow(() => {
  if (!sessionStore.isLoggedIn || userStore.profile) return;
  void userApi.getCurrent().then(profile => {
    userStore.setProfile(profile, sessionStore.uid);
  }).catch(() => undefined);
});

async function handleSubmit() {
  if (loading.value) return;

  const validationError = validateForm();
  if (validationError) {
    errorText.value = validationError;
    return;
  }

  loading.value = true;
  errorText.value = "";
  helperText.value = "";

  try {
    await userApi.changeCurrentPassword({
      operationId: createOperationId(),
      currentPassword: hasPassword.value ? currentPassword.value : undefined,
      newPassword: newPassword.value
    });
    if (userStore.profile) {
      userStore.setProfile({ ...userStore.profile, hasPassword: true }, sessionStore.uid);
    }
    helperText.value = "密码已更新";
    currentPassword.value = "";
    newPassword.value = "";
    repeatPassword.value = "";
    await uniPlatform.feedback.toast({ title: "设置成功", icon: "success" }).catch(() => undefined);
  } catch (error) {
    errorText.value = getErrorText(error);
  } finally {
    loading.value = false;
  }
}

function validateForm() {
  if (hasPassword.value && !currentPassword.value) return "请输入原密码";
  if (!newPassword.value) return "请输入新密码";
  const strengthError = validatePasswordStrength(newPassword.value);
  if (strengthError) return strengthError;
  if (!repeatPassword.value) return "请再次输入新密码";
  if (newPassword.value !== repeatPassword.value) return "两次输入的新密码不一致";
  if (hasPassword.value && currentPassword.value === newPassword.value) return "新密码不能与当前密码相同";
  return "";
}

function validatePasswordStrength(password: string) {
  if (password.length < 8 || password.length > 20) return "密码需要 8-20 位字符";
  if (getPasswordCategoryCount(password) < 2) return "密码需至少包含字母、数字、符号中的两种";
  return "";
}

function getPasswordCategoryCount(password: string) {
  return [
    /[A-Za-z]/u.test(password),
    /\d/u.test(password),
    /[^A-Za-z0-9]/u.test(password)
  ].filter(Boolean).length;
}

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, level: "weak" };
  const categoryCount = getPasswordCategoryCount(password);
  if (password.length >= 12 && password.length <= 20 && categoryCount === 3) return { score: 3, level: "strong" };
  if (password.length >= 8 && password.length <= 20 && categoryCount >= 2) return { score: 2, level: "medium" };
  return { score: 1, level: "weak" };
}

function getErrorText(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 400) return error.message || "密码设置失败，请检查后重试";
    if (error.code === 401) return "登录状态已失效，请重新登录";
    if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
  }

  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请稍后重试";
}
</script>

<style scoped lang="scss">
.password-page,
.password-login-shell {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background: var(--page-primary-soft-bg);
}

.password-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.password-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.password-strength__text,
.password-footnote {
  color: var(--color-text-secondary);
}

.password-form-card {
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface-primary-panel);
  box-shadow: var(--shadow-card);
}

.password-field {
  padding: 22rpx 24rpx;
}

.password-field--bordered {
  border-top: 1rpx solid var(--color-divider);
}

.password-field__label {
  display: block;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.password-field__input {
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: 30rpx;
}

.password-strength {
  margin-top: 20rpx;
}

.password-strength__bar {
  margin-top: 14rpx;
  height: 12rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--color-divider);
}

.password-strength__value {
  height: 100%;
  border-radius: inherit;
  transition: width 0.2s ease;
}

.password-strength__value--weak {
  background: var(--color-state-danger-text);
}

.password-strength__value--medium {
  background: var(--color-state-warning-text);
}

.password-strength__value--strong {
  background: var(--color-support-action);
}

.password-strength__text,
.password-helper,
.password-footnote {
  display: block;
  margin-top: 14rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.6;
}

.password-helper {
  color: var(--color-text-secondary);
}

.password-strength__text {
  color: var(--color-state-danger-text);
}

.password-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 92rpx;
  margin-top: 28rpx;
  border: 0;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--button-primary-shadow);
}

.password-submit::after {
  border: 0;
}
</style>
