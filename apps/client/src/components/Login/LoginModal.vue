<template>
  <view
    v-if="renderVisible"
    class="login-popup"
    :class="{
      'login-popup--phone': renderMode === 'phone',
      'login-popup--mini': renderOpenedInMiniProgram,
      'login-popup--ready': motionState !== 'entering',
      'login-popup--closing': motionState === 'closing'
    }"
    @touchmove.stop.prevent
  >
    <view class="login-popup__backdrop" @click="handleClose" />
    <view class="login-popup__panel">
      <image class="login-popup__image" :src="heroImageUrl" mode="aspectFill" @error="imageFailed = true" />
      <view class="login-popup__hero-mask" />

      <view class="login-popup__nav" @click="handleNav">
        <text class="login-popup__nav-icon cookfont" :class="navIconClass" aria-hidden="true" />
      </view>

      <view class="login-popup__content" :class="{ 'login-popup__content--phone': renderMode === 'phone' }">
        <view class="login-popup__brand">
          <text class="login-popup__app">{{ APP_NAME }}</text>
          <text class="login-popup__slogan">{{ APP_SLOGAN }}</text>
        </view>

        <template v-if="renderMode === 'wechat'">
          <view class="login-popup__wechat">
            <view
              class="login-popup__main-button"
              :class="{ 'login-popup__main-button--disabled': loading }"
              @click="handleWeChatLogin"
            >
              {{ loading ? "登录中..." : "微信一键登录" }}
            </view>
            <view class="login-popup__text-link" @click="openPhoneMode">手机号验证码登录</view>
            <view class="login-popup__text-link login-popup__text-link--muted" @click="handleClose">暂不登录</view>
          </view>
        </template>

        <template v-else>
            <view class="login-popup__phone-card">
              <view class="login-popup__phone-header">
                <text class="login-popup__phone-title font-black">手机号验证码登录</text>
                <text class="login-popup__phone-description">请输入手机号并获取验证码后登录。</text>
              </view>

            <view class="login-popup__fields">
              <input
                v-model="phone"
                class="login-popup__input"
                placeholder-class="login-popup__placeholder"
                type="number"
                maxlength="11"
                placeholder="请输入手机号"
                :disabled="loading"
              />

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
                <view
                  class="login-popup__code-button"
                  :class="{ 'login-popup__code-button--disabled': loading || countdown > 0 }"
                  @click="sendCode"
                >
                  {{ countdownText }}
                </view>
              </view>
            </view>

            <text class="login-popup__hint">{{ helperText }}</text>
            <text v-if="errorText" class="login-popup__error">{{ errorText }}</text>

            <view
              class="login-popup__main-button"
              :class="{ 'login-popup__main-button--disabled': loading }"
              @click="handlePhoneLogin"
            >
              {{ loading ? "登录中..." : "手机号登录" }}
            </view>

            <view v-if="renderOpenedInMiniProgram" class="login-popup__text-link" @click="goBackToWechatMode">
              返回微信一键登录
            </view>
            <view class="login-popup__text-link login-popup__text-link--muted" @click="handleClose">暂不登录</view>
          </view>
        </template>

        <view class="login-popup__agreement" @click="toggleAgreement">
          <text
            class="login-popup__checkbox cookfont"
            :class="agreementChecked ? 'icon-select-on login-popup__checkbox--checked' : 'icon-select-off'"
          />
          <text class="login-popup__agreement-text">登录即表示同意</text>
          <text class="login-popup__agreement-link" @click.stop="openAgreement('terms')">《用户协议》</text>
          <text class="login-popup__agreement-text">与</text>
          <text class="login-popup__agreement-link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { authApi, type AuthSessionResult } from "@/apis/auth";
import { APP_NAME, APP_SLOGAN } from "@/config";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { userApi } from "@/apis/user";
import { ApiClientError } from "@/apis/http";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { emitLoginSuccess } from "@/utils/session-events";

const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const userStore = useUserStore();

const phone = ref("");
const code = ref("");
const loading = ref(false);
const countdown = ref(0);
const errorText = ref("");
const helperText = ref("验证码将发送到你的手机号");
const agreementChecked = ref(false);
const imageFailed = ref(false);
const renderVisible = ref(false);
const renderMode = ref<"wechat" | "phone">("phone");
const renderOpenedInMiniProgram = ref(false);
const renderImageUrl = ref("");
const motionState = ref<"entering" | "open" | "closing">("entering");
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("login-modal"));

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let motionTimer: ReturnType<typeof setTimeout> | null = null;
const MINI_MOTION_MS = 280;

const heroImageUrl = computed(() => {
	if (imageFailed.value || !renderImageUrl.value) return "https://raw.githubusercontent.com/trtst/img/refs/heads/master/login-bg.jpg";
	return renderImageUrl.value;
});

const countdownText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : "发送验证码"));
const navIconClass = computed(() =>
	renderMode.value === "phone" && renderOpenedInMiniProgram.value ? "icon-back" : "icon-close"
);

watch(
	() => loginModalStore.visible,
	async (visible) => {
		if (!visible) {
			startCloseMotion();
			stopCountdown();
			return;
		}

		syncRenderState();
		renderVisible.value = true;
		motionState.value = "entering";
		resetForm();
		imageFailed.value = false;
		stopMotionTimer();
		await nextTick();
		motionTimer = setTimeout(() => {
			motionState.value = "open";
			motionTimer = null;
		}, 16);
	}
);

watch(
	() => [loginModalStore.mode, loginModalStore.openedInMiniProgram, loginModalStore.openImageUrl] as const,
	() => {
		if (!loginModalStore.visible) return;
		syncRenderState();
	}
);

watch(
	() => renderVisible.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	stopCountdown();
	stopMotionTimer();
});

function handleNav() {
	if (renderMode.value === "phone" && renderOpenedInMiniProgram.value) {
		goBackToWechatMode();
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
	loginModalStore.openPhoneMode();
}

function goBackToWechatMode() {
	errorText.value = "";
	loginModalStore.back();
}

function toggleAgreement() {
	agreementChecked.value = !agreementChecked.value;
}

function openAgreement(slug: "terms" | "privacy") {
	void uniPlatform.navigation.navigateTo(`/pages_web/content/index?slug=${slug}`).catch(() => undefined);
}

async function ensureAgreementAccepted() {
	if (agreementChecked.value) return true;

	await uniPlatform.feedback.toast({
		title: "请勾选协议",
		icon: "none"
	});
	return false;
}

async function handleWeChatLogin() {
	if (loading.value) return;
	if (!(await ensureAgreementAccepted())) return;

	loading.value = true;
	errorText.value = "";

	try {
		const login = await uniPlatform.auth.login();
		const session = await authApi.loginWithWechat({
			code: login.code
		});
		await applySession(session);
	} catch (error) {
		errorText.value = getErrorText(error);
	} finally {
		loading.value = false;
	}
}

async function sendCode() {
	if (loading.value || countdown.value > 0) return;

	const phoneText = phone.value.trim();
	if (!phoneText) {
		errorText.value = "请输入手机号";
		return;
	}

	if (!/^1[3-9]\d{9}$/.test(phoneText)) {
		errorText.value = "请输入正确的手机号";
		return;
	}

	loading.value = true;
	errorText.value = "";

	try {
		await authApi.sendCode({
			phone: phoneText,
			scene: "LOGIN"
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

async function handlePhoneLogin() {
	if (loading.value) return;
	if (!(await ensureAgreementAccepted())) return;

	const phoneText = phone.value.trim();
	const codeText = code.value.trim();
	const validationError = validateLogin(phoneText, codeText);
	if (validationError) {
		errorText.value = validationError;
		return;
	}

	loading.value = true;
	errorText.value = "";

	try {
		const session = await authApi.loginWithCode({
			phone: phoneText,
			code: codeText
		});
		await applySession(session);
	} catch (error) {
		errorText.value = getErrorText(error);
	} finally {
		loading.value = false;
	}
}

async function applySession(session: AuthSessionResult) {
	await sessionStore.setSession({
		token: session.token,
		uid: session.user.uid,
		expiresAt: session.expiresAt
	});
	userStore.setProfile(await userApi.getCurrent());

	const { sourceId, action } = loginModalStore.complete(session);
	await emitLoginSuccess({
		sourceId,
		session
	});
	action?.();
}

function validateLogin(phoneText: string, codeText: string) {
	if (!phoneText) return "请输入手机号";
	if (!/^1[3-9]\d{9}$/.test(phoneText)) return "请输入正确的手机号";
	if (!codeText) return "请输入验证码";
	if (!/^\d{6}$/.test(codeText)) return "请输入 6 位验证码";
	return "";
}

function getErrorText(error: unknown) {
	if (error instanceof ApiClientError) {
		if (error.code === 400) return error.message || "登录失败，请重试";
		if (error.code === 429) return error.message || "请求过于频繁，请稍后重试";
		if (error.code === 503) return error.message || "微信登录暂不可用";
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "登录失败，请稍后重试";
}

function resetForm() {
	phone.value = "";
	code.value = "";
	errorText.value = "";
	helperText.value = "验证码将发送到你的手机号";
	agreementChecked.value = false;
	countdown.value = 0;
	stopCountdown();
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

function syncRenderState() {
	renderMode.value = loginModalStore.mode;
	renderOpenedInMiniProgram.value = loginModalStore.openedInMiniProgram;
	renderImageUrl.value = loginModalStore.openImageUrl;
}

function startCloseMotion() {
	if (!renderVisible.value) return;
	stopMotionTimer();
	motionState.value = "closing";
	motionTimer = setTimeout(() => {
		renderVisible.value = false;
		renderMode.value = "phone";
		renderOpenedInMiniProgram.value = false;
		renderImageUrl.value = "";
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
@import "@/assets/fonts/font.scss";

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
  -webkit-backdrop-filter: blur(24rpx) saturate(145%);
  backdrop-filter: blur(24rpx) saturate(145%);
}

.login-popup__panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.login-popup__image {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.login-popup__hero-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(circle at 24% 18%, var(--login-popup-hero-mask-spot), transparent 38%),
    linear-gradient(180deg, var(--login-popup-hero-mask-top), var(--login-popup-hero-mask-bottom));
  pointer-events: none;
}

.login-popup--mini .login-popup__backdrop,
.login-popup--mini .login-popup__image,
.login-popup--mini .login-popup__hero-mask {
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

.login-popup--mini.login-popup--closing .login-popup__backdrop,
.login-popup--mini.login-popup--closing .login-popup__image,
.login-popup--mini.login-popup--closing .login-popup__hero-mask {
  opacity: 0;
  transition-duration: 140ms;
}

.login-popup--mini:not(.login-popup--ready) .login-popup__backdrop {
  opacity: 0;
}

.login-popup--mini:not(.login-popup--ready) .login-popup__image,
.login-popup--mini:not(.login-popup--ready) .login-popup__hero-mask {
  opacity: 0.72;
}

.login-popup__nav {
  position: absolute;
  top: calc(var(--size-navbar-content, 88rpx) + 12rpx);
  left: 28rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48rpx;
  min-height: 48rpx;
}

.login-popup__nav-icon {
  color: var(--color-text);
  line-height: 1;
}

.login-popup__content {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 100%;
  flex-direction: column;
  padding: calc(var(--size-navbar-content, 88rpx) + 136rpx) 48rpx calc(72rpx + env(safe-area-inset-bottom));
}

.login-popup__content--phone {
  padding-top: calc(var(--size-navbar-content, 88rpx) + 112rpx);
}

.login-popup__brand {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  text-align: center;
}

.login-popup__app {
  font-family: "阿里妈妈方圆体 VF Regular";
  font-size: 96rpx;
  font-weight: 700;
  line-height: 1.02;
  color: var(--login-popup-hero-copy);
  text-shadow: 0 8rpx 24rpx rgba(33, 64, 41, 0.08);
}

.login-popup__slogan {
  max-width: 520rpx;
  color: var(--login-popup-hero-copy-secondary);
  font-size: 30rpx;
  line-height: 1.6;
}

.login-popup__wechat {
  display: flex;
  flex-direction: column;
  gap: 34rpx;
  margin-top: auto;
}

.login-popup__phone-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: auto;
  padding: 36rpx;
  border: 2rpx solid var(--login-popup-sheet-border);
  border-radius: 36rpx;
  background: linear-gradient(180deg, var(--login-popup-sheet-overlay-start) 0%, var(--login-popup-sheet-overlay-end) 100%);
  box-shadow: var(--login-popup-sheet-shadow);
  -webkit-backdrop-filter: blur(28rpx) saturate(150%);
  backdrop-filter: blur(28rpx) saturate(150%);
}

.login-popup__phone-header {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.login-popup__phone-title {
  color: var(--login-popup-title);
  font-size: 38rpx;
  line-height: 1.3;
}

.login-popup__phone-description {
  color: var(--login-popup-description);
  font-size: 26rpx;
  line-height: 1.6;
}

.login-popup__fields {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.login-popup__input {
  width: 100%;
  min-height: 92rpx;
  box-sizing: border-box;
  padding: 0 28rpx;
  border: 2rpx solid var(--login-popup-input-border);
  border-radius: 28rpx;
  background: var(--login-popup-input-bg);
  color: var(--login-popup-input-text);
  font-size: 30rpx;
}

.login-popup__code-row {
  display: flex;
  gap: 16rpx;
}

.login-popup__input--code {
  flex: 1;
}

.login-popup__code-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 188rpx;
  min-height: 92rpx;
  padding: 0 20rpx;
  border-radius: 28rpx;
  background: var(--login-popup-code-bg);
  color: var(--login-popup-code-text);
  font-size: 28rpx;
  font-weight: 600;
}

.login-popup__code-button--disabled {
  opacity: 0.5;
}

.login-popup__hint {
  color: var(--login-popup-hint);
  font-size: 24rpx;
  line-height: 1.6;
}

.login-popup__error {
  color: var(--login-popup-error);
  font-size: 24rpx;
  line-height: 1.5;
}

.login-popup__main-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 96rpx;
  padding: 0 32rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.login-popup__main-button--disabled {
  opacity: 0.6;
}

.login-popup__text-link {
  align-self: center;
  color: var(--color-text);
  font-size: 28rpx;
  line-height: 1.5;
}

.login-popup__text-link--muted {
  color: var(--login-popup-description);
}

.login-popup__agreement {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 6rpx;
  align-items: center;
  justify-content: center;
  margin-top: 44rpx;
  color: var(--login-popup-description);
  text-align: center;
}

.login-popup__checkbox {
  color: var(--color-text-tertiary);
  font-size: 34rpx;
  line-height: 1;
}

.login-popup__checkbox--checked {
  color: var(--color-primary);
}

.login-popup__agreement-text,
.login-popup__agreement-link {
  font-size: 24rpx;
  line-height: 1.7;
}

.login-popup__agreement-link {
  color: var(--color-primary);
  font-weight: 600;
}

:deep(.login-popup__placeholder) {
  color: var(--login-popup-description);
}
</style>
