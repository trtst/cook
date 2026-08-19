<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="phone-navbar__title">绑定手机号</text>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      class="phone-login-shell"
      :style="pageBodyStyle"
      title="登录后绑定手机号"
      description="手机号仅用于账号安全、登录验证和重要通知。"
    />

    <view v-else class="phone-page" :style="pageBodyStyle">
      <view class="phone-hero">
        <text class="phone-hero__title">绑定手机号</text>
        <text class="phone-hero__description">用于账号安全、登录验证和重要通知</text>
      </view>

      <view class="phone-form-card">
        <view class="phone-field">
          <text class="phone-field__label">手机号</text>
          <view class="phone-input-row">
            <text class="phone-input-row__prefix">+86</text>
            <view class="phone-input-row__divider" />
            <input
              v-model="phoneText"
              class="phone-input-row__input"
              maxlength="11"
              type="number"
              placeholder="请输入手机号"
              :disabled="loading"
            />
          </view>
        </view>

        <view class="phone-field phone-field--last">
          <text class="phone-field__label">验证码</text>
          <view class="code-row">
            <input
              v-model="codeText"
              class="code-row__input"
              maxlength="6"
              type="number"
              placeholder="请输入验证码"
              :disabled="loading"
            />
            <button
              class="code-row__button"
              :class="{ 'code-row__button--disabled': loading || countdown > 0 }"
              :disabled="loading || countdown > 0"
              @click="handleSendCode"
            >
              {{ countdownText }}
            </button>
          </view>
        </view>
      </view>

      <view class="phone-tip">
        <view class="phone-tip__dot" />
        <text class="phone-tip__text">手机号仅用于账号安全验证，我们会妥善保护你的隐私</text>
      </view>

      <text v-if="helperText" class="phone-helper">{{ helperText }}</text>
      <text v-if="errorText" class="phone-error">{{ errorText }}</text>
      <button class="phone-submit" :disabled="loading" @click="handleBindPhone">立即绑定</button>
      <text class="phone-footnote">绑定后可在设置中更换手机号</text>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { authApi } from "@/apis/auth";
import { ApiClientError } from "@/apis/http";
import { userApi } from "@/apis/user";
import Login from "@/components/Login/Login.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const phoneText = ref("");
const codeText = ref("");
const loading = ref(false);
const countdown = ref(0);
const helperText = ref("");
const errorText = ref("");
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

let countdownTimer: ReturnType<typeof setInterval> | null = null;

const countdownText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : "获取验证码"));

onBeforeUnmount(() => {
  stopCountdown();
});

async function handleSendCode() {
  if (loading.value || countdown.value > 0) return;

  const phone = phoneText.value.trim();
  const validationError = validatePhone(phone);
  if (validationError) {
    errorText.value = validationError;
    return;
  }

  loading.value = true;
  errorText.value = "";

  try {
    await authApi.sendCode({
      phone,
      scene: "BIND_PHONE"
    });
    helperText.value = "验证码已发送，请留意短信";
    startCountdown();
    await uniPlatform.feedback.toast({ title: "验证码已发送", icon: "success" }).catch(() => undefined);
  } catch (error) {
    errorText.value = getErrorText(error);
  } finally {
    loading.value = false;
  }
}

async function handleBindPhone() {
  if (loading.value) return;

  const phone = phoneText.value.trim();
  const code = codeText.value.trim();
  const validationError = validateBindForm(phone, code);
  if (validationError) {
    errorText.value = validationError;
    return;
  }

  loading.value = true;
  errorText.value = "";

  try {
    const profile = await userApi.bindCurrentPhone({ phone, code });
    userStore.setProfile(profile);
    helperText.value = "手机号已绑定";
    await uniPlatform.feedback.toast({ title: "绑定成功", icon: "success" }).catch(() => undefined);
    codeText.value = "";
    stopCountdown();
    countdown.value = 0;
  } catch (error) {
    errorText.value = getErrorText(error);
  } finally {
    loading.value = false;
  }
}

function validatePhone(phone: string) {
  if (!phone) return "请输入手机号";
  if (!/^1[3-9]\d{9}$/u.test(phone)) return "请输入正确的手机号";
  return "";
}

function validateBindForm(phone: string, code: string) {
  const phoneError = validatePhone(phone);
  if (phoneError) return phoneError;
  if (!code) return "请输入验证码";
  if (!/^\d{6}$/u.test(code)) return "请输入 6 位验证码";
  return "";
}

function getErrorText(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 400) return error.message || "验证码有误，请重试";
    if (error.code === 401) return "登录状态已失效，请重新登录";
    if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败，请稍后重试";
}

function startCountdown() {
  countdown.value = 60;
  stopCountdown();
  countdownTimer = setInterval(() => {
    if (countdown.value <= 1) {
      stopCountdown();
      countdown.value = 0;
      return;
    }

    countdown.value -= 1;
  }, 1000);
}

function stopCountdown() {
  if (!countdownTimer) return;
  clearInterval(countdownTimer);
  countdownTimer = null;
}
</script>

<style scoped lang="scss">
.phone-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  overflow: hidden;
  background:
    radial-gradient(circle at top center, color-mix(in srgb, var(--theme-primary) 8%, transparent), transparent 42%),
    radial-gradient(circle at 12% 24%, color-mix(in srgb, var(--theme-primary) 5%, transparent), transparent 30%),
    var(--color-page);
}

.phone-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.phone-login-shell {
  box-sizing: border-box;
  height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.phone-hero {
  padding: 32rpx 0 28rpx;
  text-align: center;
}

.phone-hero__title {
  display: block;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.15;
}

.phone-hero__description,
.phone-tip__text,
.phone-footnote {
  color: var(--color-text-secondary);
}

.phone-hero__description {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.phone-form-card {
  overflow: hidden;
  border: 1rpx solid var(--color-divider);
  border-radius: 22rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, var(--theme-primary) 6%);
  box-shadow: var(--shadow-card);
}

.phone-field {
  padding: 22rpx 24rpx;
}

.phone-field--last {
  border-top: 1rpx solid var(--color-divider);
}

.phone-field__label {
  display: block;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.phone-input-row,
.code-row {
  display: flex;
  align-items: center;
  margin-top: 18rpx;
}

.phone-input-row__prefix {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.phone-input-row__divider {
  width: 1rpx;
  height: 36rpx;
  margin: 0 16rpx;
  background: var(--color-divider);
}

.phone-input-row__input,
.code-row__input {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 30rpx;
}

.phone-input-row__input::placeholder,
.code-row__input::placeholder {
  color: color-mix(in srgb, var(--color-text-tertiary) 68%, var(--color-page));
}

.code-row__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 184rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 22rpx;
  border: 0;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 16%, var(--color-surface));
  color: color-mix(in srgb, var(--theme-primary) 68%, var(--color-text));
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.code-row__button--disabled {
  opacity: 0.56;
}

.code-row__button::after {
  border: 0;
}

.phone-tip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 20rpx;
  padding: 0 2rpx;
}

.phone-tip__dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--theme-primary);
  box-shadow: 0 0 0 4rpx color-mix(in srgb, var(--theme-primary) 18%, transparent);
}

.phone-tip__text {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  line-height: 1.6;
}

.phone-helper,
.phone-error {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 24rpx;
  line-height: 1.6;
}

.phone-helper {
  color: var(--color-text-secondary);
}

.phone-error {
  color: var(--color-danger-text);
}

.phone-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 92rpx;
  margin-top: 28rpx;
  border: 0;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  color: var(--button-primary-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--button-primary-shadow);
}

.phone-submit::after {
  border: 0;
}

.phone-footnote {
  display: block;
  margin-top: 18rpx;
  text-align: center;
  font-size: 24rpx;
}
</style>
