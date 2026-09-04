<template>
  <view
    v-if="renderVisible"
    class="login-popup"
    :class="{
      'login-popup--phone': renderMode === 'phone',
      'login-popup--password': renderMode === 'password',
      'login-popup--mini': renderOpenedInMiniProgram,
      'login-popup--ready': motionState !== 'entering',
      'login-popup--closing': motionState === 'closing'
    }"
    @touchmove.stop.prevent
  >
    <view class="login-popup__backdrop" @click="handleClose" />
    <view class="login-popup__panel">
      <view class="login-popup__nav" @click="handleNav">
        <text class="login-popup__nav-icon cookfont" :class="navIconClass" aria-hidden="true" />
      </view>

      <view class="login-popup__content">
        <view class="login-popup__brand">
          <image class="login-popup__logo" :src="logoUrl" mode="widthFix" />
          <text class="login-popup__slogan">{{ APP_SLOGAN }}</text>
        </view>

        <view class="login-popup__main">
          <view class="login-popup__auth-card">
            <template v-if="renderMode === 'phone'">
              <view class="login-popup__auth-actions">
                <view class="login-popup__auth-heading">
                  <text class="login-popup__auth-title">手机号登录</text>
                  <text class="login-popup__auth-description">输入手机号，用短信验证码登录</text>
                </view>

                <view class="login-popup__fields">
                  <view class="login-popup__field">
                    <text class="login-popup__field-icon cookfont icon-login-phone" />
                    <input
                      v-model="phone"
                      class="login-popup__input"
                      placeholder-class="login-popup__placeholder"
                      type="number"
                      maxlength="11"
                      placeholder="请输入手机号"
                      :disabled="loading"
                    />
                  </view>

                  <view class="login-popup__code-row">
                    <input
                      v-model="code"
                      class="login-popup__input login-popup__input--code"
                      placeholder-class="login-popup__placeholder"
                      type="number"
                      maxlength="6"
                      placeholder="请输入验证码"
                      :disabled="loading"
                    />
                    <button
                      class="login-popup__code-button"
                      :class="{ 'login-popup__code-button--disabled': loading || countdown > 0 }"
                      :disabled="loading || countdown > 0"
                      @click="sendCode"
                    >
                      {{ countdownText }}
                    </button>
                  </view>
                </view>

                <text
                  class="login-popup__error"
                  :class="{ 'login-popup__error--success': messageTone === 'success' }"
                >
                  {{ errorText || " " }}
                </text>

                <button
                  class="login-popup__main-button"
                  :class="{ 'login-popup__main-button--disabled': loading }"
                  :disabled="loading"
                  @click="handlePhoneLogin"
                >
                  {{ loading ? "登录中..." : "登录" }}
                </button>

                <view class="login-popup__link-row">
                  <view class="login-popup__text-link" @click="openPasswordMode">密码登录</view>
                </view>
              </view>
            </template>

            <template v-else>
              <view class="login-popup__auth-actions">
                <view class="login-popup__auth-heading">
                  <text class="login-popup__auth-title">密码登录</text>
                  <text class="login-popup__auth-description">使用已设置的手机号和密码登录</text>
                </view>

                <view class="login-popup__fields">
                  <view class="login-popup__field">
                    <text class="login-popup__field-icon cookfont icon-login-phone" />
                    <input
                      v-model="phone"
                      class="login-popup__input"
                      placeholder-class="login-popup__placeholder"
                      type="number"
                      maxlength="11"
                      placeholder="请输入手机号"
                      :disabled="loading"
                    />
                  </view>
                  <view class="login-popup__field">
                    <text class="login-popup__field-icon cookfont icon-login-password" />
                    <input
                      v-model="password"
                      class="login-popup__input"
                      placeholder-class="login-popup__placeholder"
                      :password="!passwordVisible"
                      maxlength="128"
                      placeholder="请输入密码"
                      :disabled="loading"
                    />
                    <text
                      class="login-popup__visibility cookfont"
                      :class="passwordVisible ? 'icon-login-visible' : 'icon-login-hidden'"
                      @click="togglePasswordVisible"
                    />
                  </view>
                </view>

                <text
                  class="login-popup__error"
                  :class="{ 'login-popup__error--success': messageTone === 'success' }"
                >
                  {{ errorText || " " }}
                </text>

                <button
                  class="login-popup__main-button"
                  :class="{ 'login-popup__main-button--disabled': loading }"
                  :disabled="loading"
                  @click="handlePasswordLogin"
                >
                  {{ loading ? "登录中..." : "登录" }}
                </button>

                <view class="login-popup__link-row">
                  <view class="login-popup__text-link" @click="openPhoneMode">验证码登录</view>
                </view>
              </view>
            </template>

            <view class="login-popup__agreement" @click="toggleAgreement">
              <text
                class="login-popup__checkbox cookfont"
                :class="
                  agreementChecked
                    ? 'icon-select-on login-popup__checkbox--checked'
                    : agreementWarn
                      ? 'icon-select-off login-popup__checkbox--warning'
                      : 'icon-select-off'
                "
              />
              <text class="login-popup__agreement-text">登录即表示同意</text>
              <text class="login-popup__agreement-link" @click.stop="openAgreement('terms')">《用户协议》</text>
              <text class="login-popup__agreement-text">与</text>
              <text class="login-popup__agreement-link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
            </view>
          </view>
        </view>

        <view class="login-popup__copy" aria-live="polite">
          <view class="login-popup__copy-rule" />
          <view class="login-popup__copy-text">
            <text class="login-popup__copy-line">{{ loginCopy.firstLine }}</text>
            <text class="login-popup__copy-line">{{ loginCopy.secondLine }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { authApi, type AuthSessionResult } from "@/apis/auth";
import { APP_SLOGAN } from "@/config";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useTheme } from "@/composables/useTheme";
import { userApi } from "@/apis/user";
import { ApiClientError } from "@/apis/http";
import lightLogo from "@/assets/logo.png";
import darkLogo from "@/assets/assets-logo.png";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { emitLoginSuccess } from "@/utils/session-events";
import { pickLoginCopy } from "./types";

const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const { effectiveTheme } = useTheme();

const phone = ref("");
const code = ref("");
const password = ref("");
const passwordVisible = ref(false);
const wechatSessionId = ref("");
const loading = ref(false);
const countdown = ref(0);
const errorText = ref("");
const messageTone = ref<"error" | "success">("error");
const agreementChecked = ref(false);
const agreementWarn = ref(false);
const loginCopy = ref(pickLoginCopy());
const renderVisible = ref(false);
const renderMode = ref<"wechat" | "phone" | "password">("phone");
const renderOpenedInMiniProgram = ref(false);
const motionState = ref<"entering" | "open" | "closing">("entering");
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("login-modal"));

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let motionTimer: ReturnType<typeof setTimeout> | null = null;
const MINI_MOTION_MS = 280;

const logoUrl = computed(() => (effectiveTheme.value === "dark" ? darkLogo : lightLogo));
const countdownText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : "发送验证码"));
const navIconClass = computed(() => {
  if (renderMode.value === "password") return "icon-back";
  return "icon-close";
});

watch(
  () => loginModalStore.visible,
  async visible => {
    if (!visible) {
      startCloseMotion();
      stopCountdown();
      return;
    }

    syncRenderState();
    renderVisible.value = true;
    motionState.value = "entering";
    resetForm();
    stopMotionTimer();
    await nextTick();
    motionTimer = setTimeout(() => {
      motionState.value = "open";
      motionTimer = null;
    }, 16);
  }
);

watch(
  () => [loginModalStore.mode, loginModalStore.openedInMiniProgram] as const,
  () => {
    if (!loginModalStore.visible) return;
    syncRenderState();
  }
);

watch(
  () => renderVisible.value,
  visible => {
    setPageLocked(visible);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopCountdown();
  stopMotionTimer();
});

function handleNav() {
  if (renderMode.value === "password") {
    openPhoneMode();
    return;
  }

  handleClose();
}

function handleClose() {
  stopCountdown();
  loginModalStore.close();
}

function openPhoneMode() {
  errorText.value = "";
  agreementWarn.value = false;
  wechatSessionId.value = sessionStore.wechatSessionId;
  loginModalStore.openPhoneMode();
}

function openPasswordMode() {
  errorText.value = "";
  agreementWarn.value = false;
  loginModalStore.openPasswordMode();
}

function toggleAgreement() {
  agreementChecked.value = !agreementChecked.value;
  agreementWarn.value = false;
}

function togglePasswordVisible() {
  passwordVisible.value = !passwordVisible.value;
}

function openAgreement(slug: "terms" | "privacy") {
  void uniPlatform.navigation.navigateTo(`/pages_web/content/index?slug=${slug}`).catch(() => undefined);
}

async function ensureAgreementAccepted() {
  if (agreementChecked.value) return true;

  agreementWarn.value = true;
  await uniPlatform.feedback.toast({
    title: "请勾选协议",
    icon: "none",
    tone: "error",
    placement: "bottom"
  });
  return false;
}

async function handleWeChatPhoneLogin(event: unknown) {
  if (loading.value) return;
  if (!(await ensureAgreementAccepted())) return;

  loading.value = true;
  errorText.value = "";

  try {
    const deviceId = uniPlatform.auth.getDeviceId();
    let currentWechatSessionId = sessionStore.wechatSessionId;

    if (!currentWechatSessionId) {
      const login = await uniPlatform.auth.login();
      const result = await authApi.wechatSession({
        code: login.code,
        deviceId
      });

      if (result.status === "BLOCKED") {
        await showAuthError(blockedText(result.retryAfterSeconds));
        return;
      }

      if (result.status === "BOUND") {
        await applySession(result.session);
        return;
      }

      currentWechatSessionId = result.wechatSessionId;
      sessionStore.setWechatSessionId(currentWechatSessionId);
    }

    const phoneCode = await uniPlatform.auth.getPhoneNumberCode(event);
    wechatSessionId.value = currentWechatSessionId;
    const session = await authApi.loginWithWechatPhone({
      wechatSessionId: currentWechatSessionId,
      phoneCode,
      deviceId
    });
    await applySession(session);
  } catch (error) {
    await showAuthError(error);
  } finally {
    loading.value = false;
  }
}

async function sendCode() {
  if (loading.value || countdown.value > 0) return;
  if (!(await ensureAgreementAccepted())) return;

  const phoneText = phone.value.trim();
  const validationError = validatePhone(phoneText);
  if (validationError) {
    await showAuthError(validationError);
    return;
  }

  loading.value = true;
  errorText.value = "";
  messageTone.value = "error";

  try {
    const result = await authApi.sendSmsCode({
      phone: phoneText,
      deviceId: uniPlatform.auth.getDeviceId()
    });
    errorText.value = "【速通互联验证码】您的验证码发送成功。";
    messageTone.value = "success";
    startCountdown(result.cooldownSeconds);
    await uniPlatform.feedback.toast({ title: "验证码已发送", icon: "success", placement: "bottom" }).catch(() => undefined);
  } catch (error) {
    await showAuthError(error);
  } finally {
    loading.value = false;
  }
}

async function handlePhoneLogin() {
  if (loading.value) return;
  if (!(await ensureAgreementAccepted())) return;

  const phoneText = phone.value.trim();
  const codeText = code.value.trim();
  const validationError = validateSmsLogin(phoneText, codeText);
  if (validationError) {
    await showAuthError(validationError);
    return;
  }

  loading.value = true;
  errorText.value = "";
  messageTone.value = "error";

  try {
    const request: Parameters<typeof authApi.loginWithSms>[0] = {
      phone: phoneText,
      code: codeText,
      deviceId: uniPlatform.auth.getDeviceId()
    };
    if (wechatSessionId.value) request.wechatSessionId = wechatSessionId.value;
    const session = await authApi.loginWithSms(request);
    await applySession(session);
  } catch (error) {
    await showAuthError(error);
  } finally {
    loading.value = false;
  }
}

async function handlePasswordLogin() {
  if (loading.value) return;
  if (!(await ensureAgreementAccepted())) return;

  const phoneText = phone.value.trim();
  const passwordText = password.value;
  const validationError = validatePasswordLogin(phoneText, passwordText);
  if (validationError) {
    await showAuthError(validationError);
    return;
  }

  loading.value = true;
  errorText.value = "";
  messageTone.value = "error";

  try {
    const session = await authApi.loginWithPassword({
      phone: phoneText,
      password: passwordText,
      deviceId: uniPlatform.auth.getDeviceId()
    });
    await applySession(session);
  } catch (error) {
    await showAuthError(error);
  } finally {
    loading.value = false;
  }
}

async function applySession(session: AuthSessionResult) {
  await sessionStore.setSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    uid: session.user.uid,
    user: session.user,
    expiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt
  });
  userStore.setProfile(await userApi.getCurrent(), session.user.uid);

  const { sourceId, action } = loginModalStore.complete();
  await emitLoginSuccess({
    sourceId,
    session
  });
  action?.();
}

function validatePhone(phoneText: string) {
  if (!phoneText) return "请输入手机号";
  if (!/^1[3-9]\d{9}$/.test(phoneText)) return "请输入正确的手机号";
  return "";
}

function validateSmsLogin(phoneText: string, codeText: string) {
  const phoneError = validatePhone(phoneText);
  if (phoneError) return phoneError;
  if (!codeText) return "请输入验证码";
  if (!/^\d{6}$/.test(codeText)) return "请输入 6 位验证码";
  return "";
}

function validatePasswordLogin(phoneText: string, passwordText: string) {
  const phoneError = validatePhone(phoneText);
  if (phoneError) return phoneError;
  if (!passwordText) return "请输入密码";
  if (passwordText.length < 6) return "密码至少 6 位";
  return "";
}

function blockedText(retryAfterSeconds: number | null) {
  if (retryAfterSeconds && retryAfterSeconds > 0) return `登录请求过于频繁，请 ${retryAfterSeconds} 秒后再试`;
  return "登录请求过于频繁，请稍后再试";
}

async function showAuthError(error: unknown) {
  const message = typeof error === "string" ? error : getErrorText(error);
  errorText.value = message;
  messageTone.value = "error";
  await uniPlatform.feedback.toast({
    title: message,
    icon: "none",
    tone: "error",
    placement: "bottom"
  }).catch(() => undefined);
}

function getErrorText(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === 400) return error.message || "登录失败，请重试";
    if (error.code === 401) return error.message || "登录凭证无效，请重试";
    if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
    if (error.code === 503) return error.message || "登录服务暂不可用";
  }

  if (error instanceof Error && error.message) return error.message;
  return "登录失败，请稍后重试";
}

function resetForm() {
  phone.value = "";
  code.value = "";
  password.value = "";
  passwordVisible.value = false;
  wechatSessionId.value = sessionStore.wechatSessionId;
  errorText.value = "";
  messageTone.value = "error";
  agreementChecked.value = false;
  agreementWarn.value = false;
  loginCopy.value = pickLoginCopy();
  countdown.value = 0;
  stopCountdown();
}

function startCountdown(seconds: number) {
  countdown.value = Math.max(1, Math.floor(seconds));
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

function syncRenderState() {
  renderMode.value = loginModalStore.mode;
  renderOpenedInMiniProgram.value = loginModalStore.openedInMiniProgram;
}

function startCloseMotion() {
  if (!renderVisible.value) return;
  stopMotionTimer();
  motionState.value = "closing";
  motionTimer = setTimeout(() => {
    renderVisible.value = false;
    renderMode.value = "phone";
    renderOpenedInMiniProgram.value = false;
    motionState.value = "entering";
    motionTimer = null;
  }, renderOpenedInMiniProgram.value ? MINI_MOTION_MS : 0);
}

function stopMotionTimer() {
  if (!motionTimer) return;
  clearTimeout(motionTimer);
  motionTimer = null;
}
</script>

<style lang="scss">
@use "@/assets/fonts/font.scss";

.login-popup {
  position: fixed;
  inset: 0;
  z-index: 1500;
}

.login-popup__backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--login-popup-backdrop-bg);
}

.login-popup__panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  background: var(--page-primary-soft-bg);
}

.login-popup--mini .login-popup__backdrop {
  transition: opacity 220ms ease;
}

.login-popup--mini .login-popup__panel {
  transform: translate3d(0, 100%, 0);
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.login-popup--mini.login-popup--ready .login-popup__panel {
  transform: translate3d(0, 0, 0);
}

.login-popup--mini.login-popup--closing .login-popup__panel {
  transform: translate3d(0, 100%, 0);
}

.login-popup--mini.login-popup--closing .login-popup__backdrop {
  opacity: 0;
  transition-duration: 140ms;
}

.login-popup--mini:not(.login-popup--ready) .login-popup__backdrop {
  opacity: 0;
}

.login-popup__nav {
  position: absolute;
  top: calc(var(--size-navbar-content, 88rpx) + 12rpx);
  left: 28rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 64rpx;
  min-height: 64rpx;
}

.login-popup__nav-icon {
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.login-popup__content {
  position: relative;
  z-index: 2;
  display: flex;
  box-sizing: border-box;
  min-height: 100%;
  flex-direction: column;
  padding: calc(var(--size-navbar-content, 88rpx) + 96rpx) 52rpx calc(34rpx + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.login-popup__brand {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  padding-top: 100rpx;
}

.login-popup__logo {
  display: block;
  width: 320rpx;
  height: auto;
}

.login-popup__slogan {
  max-width: 520rpx;
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1.6;
}

.login-popup__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 0 200rpx;
}

.login-popup__auth-card {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.login-popup__wechat-actions,
.login-popup__auth-actions {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.login-popup__auth-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.login-popup__auth-title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.25;
}

.login-popup__auth-description {
  color: var(--color-text-secondary);
  font-size: 25rpx;
  line-height: 1.6;
}

.login-popup__fields {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.login-popup__field {
  display: flex;
  box-sizing: border-box;
  height: 92rpx;
  align-items: center;
  gap: 16rpx;
  padding: 0 22rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
}

.login-popup__field .login-popup__input {
  flex: 1;
  min-width: 0;
  min-height: auto;
  padding: 0;
  border: 0;
  background: transparent;
}

.login-popup__field-icon {
  color: var(--color-text-tertiary);
  font-size: 34rpx;
  line-height: 1;
}

.login-popup__visibility {
  display: flex;
  min-width: 64rpx;
  min-height: 64rpx;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 34rpx;
  line-height: 1;
}

.login-popup__input {
  width: 100%;
  min-height: 92rpx;
  box-sizing: border-box;
  padding: 0 28rpx;
  border: 2rpx solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 30rpx;
}

.login-popup__code-row {
  display: flex;
  gap: 16rpx;
  align-items: stretch;
}

.login-popup__input--code {
  flex: 1;
  min-width: 0;
}

.login-popup__code-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 188rpx;
  min-height: 92rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft-fill);
  color: var(--color-primary);
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.2;
}

.login-popup__code-button.login-popup__code-button[disabled] {
  border: 0;
  background: var(--button-primary-bg);
  color: var(--color-overlay-text);
  opacity: 1;
}

.login-popup__code-button.login-popup__code-button[disabled][type="default"] {
  border: 0;
  background: var(--button-primary-bg);
  color: var(--color-overlay-text);
  opacity: 1;
}

.login-popup__code-button::after,
.login-popup__main-button::after {
  border: 0;
}

.login-popup__main-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 90rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-primary);
  box-shadow: var(--button-primary-shadow);
  color: var(--theme-on-primary);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1;
}

.login-popup__main-button.login-popup__main-button[disabled] {
  border: 0;
  background: var(--color-primary);
  color: var(--theme-on-primary);
  opacity: 1;
}

.login-popup__main-button.login-popup__main-button[disabled][type="default"] {
  border: 0;
  background: var(--color-primary);
  color: var(--theme-on-primary);
  opacity: 1;
}

.login-popup__main-button--disabled {
  opacity: 0.52;
}

.login-popup__code-button--disabled {
  background: var(--button-primary-bg);
  color: var(--color-overlay-text);
  opacity: 1;
}

.login-popup__text-link {
  align-self: center;
  color: var(--color-text);
  font-size: 27rpx;
  line-height: 1.5;
}

.login-popup__link-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
}

.login-popup__error {
  display: block;
  height: 40rpx;
  color: var(--color-state-danger-text);
  font-size: 25rpx;
  line-height: 40rpx;
}

.login-popup__error--success {
  color: var(--color-state-success-text);
}

.login-popup__copy {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  text-align: center;
}

.login-popup__copy-rule {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2rpx;
  background: var(--color-border);
  opacity: 0.62;
  transform: translateY(-50%);
}

.login-popup__copy-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  max-width: 440rpx;
  padding: 0 24rpx;
  background: var(--color-page);
}

.login-popup__copy-line {
  color: var(--color-text-tertiary);
  font-size: 25rpx;
  line-height: 1.45;
}

.login-popup__agreement {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 6rpx;
  align-items: center;
  justify-content: center;
  margin-top: 28rpx;
  color: var(--color-text-tertiary);
  text-align: center;
}

.login-popup__checkbox {
  color: var(--color-text-tertiary);
  font-size: 32rpx;
  line-height: 1;
}

.login-popup__checkbox--checked {
  color: var(--color-primary);
}

.login-popup__checkbox--warning {
  color: var(--color-state-danger-text);
}

.login-popup__agreement-text,
.login-popup__agreement-link {
  font-size: 24rpx;
  line-height: 32rpx;
}

.login-popup__agreement-link {
  color: var(--color-primary);
  font-weight: 600;
}

:deep(.login-popup__placeholder) {
  color: var(--color-text-tertiary);
}
</style>
